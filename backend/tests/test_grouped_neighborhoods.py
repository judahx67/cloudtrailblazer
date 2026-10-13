import pytest
import simplejson as json
from cloudtrailblazer.cases import CaseStore
from cloudtrailblazer.relationships import GraphScope, ProjectionLimitExceeded, RelationshipStore
from cloudtrailblazer.web import create_app
from fastapi.testclient import TestClient


@pytest.fixture
def dense(tmp_path):
    records = []
    for index in range(61):
        records.append(
            {
                "eventID": str(index),
                "eventTime": "2024-01-01T00:00:00Z",
                "eventSource": "s3.amazonaws.com",
                "eventName": "PutObject" if index == 60 else "GetObject",
                "userIdentity": {"type": "IAMUser", "arn": "arn:aws:iam::123456789012:user/alice"},
                "sourceIPAddress": "192.0.2.1",
                "resources": [{"ARN": f"arn:aws:s3:::example/object-{index:03d}"}],
                **({"errorCode": "AccessDenied"} if index % 2 else {}),
            }
        )
    # One event supports two targets; duplicates must inflate neither events nor members.
    records[0]["resources"].append({"ARN": "arn:aws:s3:::example/object-001"})
    source = tmp_path / "dense.json"
    source.write_text(json.dumps(records + [records[0]]), encoding="utf-8")
    cases = CaseStore(tmp_path / "cases")
    case_id = cases.import_case([source], name="Dense groups")["case_id"]
    store = RelationshipStore(cases, max_nodes=5)
    identity = store.identities(case_id)["items"][0]["id"]
    return cases, case_id, store, GraphScope(identity_id=identity)


def test_grouping_preserves_unique_counts_outcomes_and_complete_evidence(dense):
    _, case_id, store, scope = dense
    with pytest.raises(ProjectionLimitExceeded):
        store.graph(case_id, scope)
    graph = store.grouped_graph(case_id, scope)
    assert graph["event_count"] == 61
    assert len(graph["nodes"]) == 3
    target = next(node for node in graph["nodes"] if node.get("group_type") == "target")
    assert target["member_count"] == 61
    assert target["event_count"] == 61
    links = [edge for edge in graph["connections"] if edge["kind"] == "action"]
    assert sorted(edge["event_count"] for edge in links) == [30, 31]
    mixed = next(edge for edge in links if edge["outcome"] != "failed")
    assert mixed["action"] == "Activity"
    assert mixed["action_count"] == 2
    for link in links:
        page = store.grouped_connection_events(case_id, link["id"], scope, limit=500)
        assert page["total"] == link["event_count"]
        assert len({row["event_key"] for row in page["items"]}) == page["total"]
        assert {row["outcome"] for row in page["items"]} == {link["outcome"]}


def test_member_pages_search_and_child_links_keep_stable_evidence_ids(dense):
    _, case_id, store, scope = dense
    group = next(
        node
        for node in store.grouped_graph(case_id, scope)["nodes"]
        if node.get("group_type") == "target"
    )
    first = store.group_page(case_id, group["id"], scope, limit=2)
    second = store.group_page(case_id, group["id"], scope, limit=2, offset=2)
    assert first["total"] == second["total"] == 61
    focus = next(node for node in first["graph"]["nodes"] if node["id"] == scope.identity_id)
    assert focus["event_count"] == first["graph"]["event_count"] == 2

    def ids(page):
        return {node["id"] for node in page["graph"]["nodes"]} - {scope.identity_id}

    assert not ids(first) & ids(second)
    filtered = store.group_page(case_id, group["id"], scope, search="object-001", limit=2)
    assert filtered["total"] == 1
    for link in filtered["graph"]["connections"]:
        original = next(edge for edge in first["graph"]["connections"] if edge["id"] == link["id"])
        assert original == link
        events = store.grouped_connection_events(case_id, link["id"], scope, group_id=group["id"])
        assert events["total"] == link["event_count"]
    assert store.group_page(case_id, group["id"], scope, search="absent")["total"] == 0
    with pytest.raises(KeyError):
        store.grouped_connection_events(case_id, filtered["graph"]["connections"][0]["id"], scope)


def test_grouped_routes_validate_scope_and_preserve_time(dense):
    cases, case_id, store, scope = dense
    with TestClient(create_app(cases, relationships=store), base_url="http://127.0.0.1") as http:
        base = f"/api/cases/{case_id}"
        assert http.get(base + "/grouped-graph").status_code == 400
        params = {"identity": scope.identity_id}
        graph = http.get(base + "/grouped-graph", params=params).json()
        group = next(node for node in graph["nodes"] if node.get("group_type") == "target")
        path = base + "/groups/" + group["id"]
        assert http.get(path, params={**params, "limit": 0}).status_code == 422
        assert http.get(path, params={**params, "expand_sessions": "true"}).status_code == 400
        assert http.get(path, params={**params, "end": "2024-01-01T00:00:00Z"}).status_code == 404
        page = http.get(path, params={**params, "limit": 2}).json()
        link = page["graph"]["connections"][0]
        events = http.get(
            base + f"/grouped-connections/{link['id']}/events",
            params={**params, "group": group["id"]},
        ).json()
        assert events["total"] == link["event_count"]
        assert (
            http.get(
                base + "/grouped-graph", params={**params, "end": "2024-01-01T00:00:00Z"}
            ).json()["nodes"]
            == []
        )


def test_service_owner_region_and_fallback_groups_are_separate(tmp_path):
    actor = {"type": "IAMUser", "arn": "arn:aws:iam::123456789012:user/alice"}
    records = []
    for i, (service, resource) in enumerate(
        [
            ("ec2.amazonaws.com", "arn:aws:ec2:us-east-1:123456789012:instance/i-a"),
            ("ec2.amazonaws.com", "arn:aws:ec2:us-west-2:123456789012:instance/i-b"),
            ("ec2.amazonaws.com", "arn:aws:ec2:us-east-1:999999999999:instance/i-c"),
            ("other.amazonaws.com", "arn:aws:ec2:us-east-1:123456789012:instance/i-a"),
            ("ec2.amazonaws.com", None),
        ]
    ):
        records.append(
            {
                "eventID": str(i),
                "eventTime": "2024-01-01T00:00:00Z",
                "eventSource": service,
                "eventName": "Read",
                "userIdentity": actor,
                "resources": [{"ARN": resource}] if resource else [],
            }
        )
    path = tmp_path / "groups.json"
    path.write_text(json.dumps(records), encoding="utf-8")
    cases = CaseStore(tmp_path / "cases")
    case_id = cases.import_case([path], name="Group boundaries")["case_id"]
    store = RelationshipStore(cases)
    scope = GraphScope(identity_id=store.identities(case_id)["items"][0]["id"])
    groups = [
        node for node in store.grouped_graph(case_id, scope)["nodes"] if node["kind"] == "group"
    ]
    assert len(groups) == 5
    assert sum(node["target_unspecified"] for node in groups) == 1
    with pytest.raises(ProjectionLimitExceeded):
        RelationshipStore(cases, max_events=1).grouped_graph(case_id, scope)
