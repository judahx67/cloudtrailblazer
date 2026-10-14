from decimal import Decimal
from uuid import uuid4

import pytest
import simplejson as json
from cloudtrailblazer.cases import CaseStore
from cloudtrailblazer.cli import main
from cloudtrailblazer.relationships import RelationshipStore
from cloudtrailblazer.web import create_app
from fastapi.testclient import TestClient


@pytest.fixture
def case(tmp_path):
    event = {
        "eventTime": "2024-08-18T13:05:25.123456Z",
        "eventID": "one",
        "eventSource": "cloudtrail.amazonaws.com",
        "eventName": "DeleteTrail",
        "errorCode": "AccessDenied",
        "sourceIPAddress": "192.0.2.1",
        "userIdentity": {
            "type": "IAMUser",
            "accountId": "123456789012",
            "arn": "arn:aws:iam::123456789012:user/alice",
        },
        "requestParameters": {"precise": Decimal("0.123456789012345678901")},
    }
    later = {**event, "eventTime": "2024-08-18T13:06:25Z", "eventID": "two"}
    source = tmp_path / "source.json"
    source.write_text(json.dumps([event, event, event, later]), encoding="utf-8")
    store = CaseStore(tmp_path / "cases")
    manifest = store.import_case([source], name="<script>case</script>")
    return store, manifest["case_id"], event


def client(store, **kwargs):
    return TestClient(create_app(store, **kwargs), base_url="http://127.0.0.1")


def test_case_discovery_summary_and_exact_full_range(case):
    store, case_id, _ = case
    with client(store) as http:
        page = http.get("/api/cases").json()
        assert page["total"] == 1
        assert page["items"][0]["case_id"] == case_id
        assert page["items"][0]["event_count"] == 2
        summary = http.get(f"/api/cases/{case_id}").json()
        assert summary["duplicate_count"] == 2
        assert summary["time_range"] == {
            "start": "2024-08-18T13:05:25.123456+00:00",
            "end": "2024-08-18T13:06:25.000001+00:00",
        }
        full = http.get(f"/api/cases/{case_id}/events", params=summary["time_range"]).json()
        assert full["total"] == 2
        page = http.get(f"/api/cases/{case_id}/events", params={"limit": 1, "offset": 1}).json()
        assert page["total"] == 2
        assert page["items"][0]["event_id"] == "two"
        scoped = http.get(
            f"/api/cases/{case_id}/events",
            params={"start": "2024-08-18T20:05:25+07:00", "end": "2024-08-18T13:06:25Z"},
        ).json()
        assert scoped["total"] == 1
        assert scoped["scope"]["start"] == "2024-08-18T13:05:25+00:00"


def test_evidence_precision_and_occurrence_pages(case):
    store, case_id, event = case
    with client(store) as http:
        key = http.get(f"/api/cases/{case_id}/events").json()["items"][0]["event_key"]
        response = http.get(f"/api/cases/{case_id}/events/{key}", params={"limit": 2})
        data = response.json()
        assert "0.123456789012345678901" in data["event_json"]
        assert json.loads(data["event_json"], use_decimal=True) == event
        assert data["occurrence_count"] == 3
        assert [ref["ordinal"] for ref in data["occurrences"]] == [0, 1]
        assert len(data["occurrences"][0]["source"]["sha256"]) == 64
        next_page = http.get(
            f"/api/cases/{case_id}/events/{key}", params={"limit": 2, "offset": 2}
        ).json()
        assert [ref["ordinal"] for ref in next_page["occurrences"]] == [2]


def test_relationship_endpoints_scope_and_budget_errors(case):
    store, case_id, _ = case
    with client(store) as http:
        identity = http.get(f"/api/cases/{case_id}/identities", params={"search": "alice"}).json()[
            "items"
        ][0]
        graph = http.get(f"/api/cases/{case_id}/graph", params={"identity": identity["id"]}).json()
        assert graph["event_count"] == 2
        connection = next(item for item in graph["connections"] if item["kind"] == "action")
        path = f"/api/cases/{case_id}/connections/{connection['id']}/events"
        assert http.get(path, params={"end": "2024-08-18T13:06:25Z"}).json()["total"] == 1
        assert http.get(path, params={"start": "2025-01-01T00:00:00Z"}).status_code == 404
    with client(store, relationships=RelationshipStore(store, max_events=1)) as http:
        response = http.get(f"/api/cases/{case_id}/graph")
        assert response.status_code == 413
        assert response.json()["error"]["code"] == "projection_limit"


def test_focused_connection_keeps_identity_time_and_duplicate_semantics(case):
    store, _, event = case
    outside = {**event, "eventTime": "2024-08-18T13:06:25Z", "eventID": "outside"}
    peer = {
        **event,
        "eventID": "peer",
        "userIdentity": {**event["userIdentity"], "arn": "arn:aws:iam::123456789012:user/bob"},
    }
    source = store.root.parent / "focused.json"
    source.write_text(json.dumps([event, event, outside, peer]), encoding="utf-8")
    case_id = store.import_case([source], name="Focused connection")["case_id"]
    with client(store) as http:
        identities = http.get(f"/api/cases/{case_id}/identities").json()["items"]
        alice = next(node for node in identities if node["label"] == "alice")
        scope = {"identity": alice["id"], "end": "2024-08-18T13:06:25Z"}
        graph = http.get(f"/api/cases/{case_id}/graph", params=scope).json()
        assert graph["event_count"] == 1
        assert not any(node["label"] == "bob" for node in graph["nodes"])
        summaries = http.get(f"/api/cases/{case_id}/events").json()["items"]
        original = next(row for row in summaries if row["event_id"] == "one")
        for edge in graph["connections"]:
            page = http.get(
                f"/api/cases/{case_id}/connections/{edge['id']}/events", params=scope
            ).json()
            assert page["total"] == 1
            assert page["items"][0]["event_id"] == "one"
            assert page["items"][0]["event_time"] == "2024-08-18T13:05:25.123456+00:00"
            assert page["items"][0] == original


@pytest.mark.parametrize("query", [{"limit": 0}, {"limit": 501}, {"offset": -1}, {"limit": "bad"}])
def test_invalid_pagination(case, query):
    store, case_id, _ = case
    with client(store) as http:
        for path in [
            "/api/cases",
            f"/api/cases/{case_id}/events",
            f"/api/cases/{case_id}/identities",
        ]:
            response = http.get(path, params=query)
            assert response.status_code == 422
            assert response.json()["error"]["code"] == "invalid_query"


@pytest.mark.parametrize(
    "query",
    [
        {"start": "bad"},
        {"start": ""},
        {"start": "2024-08-18T13:05:25"},
        {"start": "2024-08-18T13:06:25Z", "end": "2024-08-18T13:05:25Z"},
    ],
)
def test_invalid_times_have_visible_errors(case, query):
    store, case_id, _ = case
    with client(store) as http:
        for endpoint in ("events", "identities", "graph"):
            response = http.get(f"/api/cases/{case_id}/{endpoint}", params=query)
            assert response.status_code == 400
            assert response.json()["error"]["code"] == "invalid_request"


def test_missing_objects_and_read_only_routes(case):
    store, case_id, _ = case
    with client(store) as http:
        assert http.get(f"/api/cases/{uuid4()}/events").status_code == 404
        assert http.get(f"/api/cases/{case_id}/events/missing").status_code == 404
        assert http.get("/api/cases/not-a-case/events").status_code == 400
        for method in ("post", "put", "delete", "patch"):
            assert getattr(http, method)("/api/cases").status_code == 405
        assert http.get("/assets/../cases.py").status_code == 404
        assert http.get("/assets/%2e%2e/cases.py").status_code == 404


def test_empty_and_unavailable_case_catalog(tmp_path):
    store = CaseStore(tmp_path / "cases")
    with client(store) as http:
        assert http.get("/api/cases").json() == {"total": 0, "unavailable_count": 0, "items": []}
        assert not store.root.exists()
        source = tmp_path / "empty.json"
        source.write_text("[]")
        empty = store.import_case([source], name="Empty")
        assert http.get(f"/api/cases/{empty['case_id']}").json()["time_range"] == {
            "start": None,
            "end": None,
        }
        assert http.get(f"/api/cases/{empty['case_id']}/events").json()["items"] == []
        bad = store.root / str(uuid4())
        bad.mkdir()
        (bad / "manifest.json").write_text('{"schema_version": 999}')
        (store.root / ".import-unpublished").mkdir()
        page = http.get("/api/cases").json()
        assert page["total"] == page["unavailable_count"] == 1
        malformed = store.root / str(uuid4())
        malformed.mkdir()
        (malformed / "manifest.json").write_text(
            json.dumps(
                {
                    "schema_version": 1,
                    "case_id": malformed.name,
                    "name": None,
                    "created_at": 42,
                    "event_count": "bad",
                }
            )
        )
        page = http.get("/api/cases").json()
        assert page["total"] == 1
        assert page["unavailable_count"] == 2
        assert http.get("/api/cases", params={"offset": 1}).json()["items"] == []


def test_local_browser_security_and_bundled_assets(tmp_path):
    with client(CaseStore(tmp_path / "cases")) as http:
        page = http.get("/")
        assert page.status_code == 200
        assert "Evidence inspector" in page.text
        assert page.headers["cache-control"] == "no-store"
        assert "script-src 'self'" in page.headers["content-security-policy"]
        for path in (
            "workbench.css",
            "app.mjs",
            "client.mjs",
            "graph.mjs",
            "identity-workbench.mjs",
            "ui.mjs",
            "subgraph-window.mjs",
            "pointer-drag.mjs",
            "panel-layout.mjs",
            "scroll-pages.mjs",
        ):
            response = http.get(f"/assets/{path}")
            assert response.status_code == 200
            assert (
                "javascript" in response.headers["content-type"]
                if path.endswith("mjs")
                else "text/css" in response.headers["content-type"]
            )
        assert http.get("/api/cases", headers={"Origin": "http://127.0.0.1"}).status_code == 200
        assert (
            http.get("/api/cases", headers={"Origin": "https://foreign.example"}).status_code == 403
        )
        assert http.get("/api/cases", headers={"Sec-Fetch-Site": "cross-site"}).status_code == 403
        assert http.get("/api/cases", headers={"Host": "foreign.example"}).status_code == 400
        assert "access-control-allow-origin" not in http.get("/api/cases").headers


def test_cli_serve_is_loopback_only(tmp_path, monkeypatch, capsys):
    calls = []
    monkeypatch.setattr("uvicorn.run", lambda app, **kwargs: calls.append(kwargs))
    prefix = ["--data-dir", str(tmp_path / "cases"), "serve"]
    assert main([*prefix, "--port", "8766"]) == 0
    assert calls == [{"host": "127.0.0.1", "port": 8766, "proxy_headers": False}]
    assert main([*prefix, "--port", "0"]) == 1
    assert "port" in capsys.readouterr().err
