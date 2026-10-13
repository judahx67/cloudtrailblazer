from copy import deepcopy

import pytest
import simplejson as json
from cloudtrailblazer.cases import CaseStore
from cloudtrailblazer.cli import main
from cloudtrailblazer.relationships import GraphScope, ProjectionLimitExceeded, RelationshipStore

ACCOUNT = "123456789012"
ROLE = f"arn:aws:iam::{ACCOUNT}:role/Investigator"


def event(number=1, **fields):
    return {
        "eventID": str(number),
        "eventTime": "2024-08-18T13:05:25Z",
        "eventSource": "cloudtrail.amazonaws.com",
        "eventName": "DeleteTrail",
        "recipientAccountId": ACCOUNT,
        "awsRegion": "us-east-1",
        "sourceIPAddress": "192.0.2.1",
        "userIdentity": {
            "type": "IAMUser",
            "accountId": ACCOUNT,
            "arn": f"arn:aws:iam::{ACCOUNT}:user/alice",
            "userName": "alice",
        },
        **fields,
    }


def session(credential="ASIAEXAMPLE", **fields):
    return {
        "type": "AssumedRole",
        "accountId": ACCOUNT,
        "arn": f"arn:aws:sts::{ACCOUNT}:assumed-role/Investigator/reused-name",
        "principalId": "ROLEID:reused-name",
        "accessKeyId": credential,
        "sessionContext": {"sessionIssuer": {"arn": ROLE, "accountId": ACCOUNT}},
        **fields,
    }


def imported(tmp_path, records):
    path = tmp_path / "input.json"
    path.write_text(json.dumps(records), encoding="utf-8")
    cases = CaseStore(tmp_path / "cases")
    case_id = cases.import_case([path], name="Relationships")["case_id"]
    return cases, case_id, RelationshipStore(cases)


def actions(graph):
    return [edge for edge in graph["connections"] if edge["kind"] == "action"]


def test_aggregation_outcomes_provenance_and_pages(tmp_path):
    denied = event(
        errorCode="AccessDenied", errorMessage="trail named secret", requestParameters=None
    )
    later = event(2, errorCode="AccessDenied", eventTime="2024-08-18T13:06:25Z")
    cases, case_id, store = imported(tmp_path, [denied, denied, denied, later, event(3)])
    graph = store.graph(case_id)
    assert graph["event_count"] == 3
    assert sorted(edge["event_count"] for edge in actions(graph)) == [1, 2]
    edge = next(edge for edge in actions(graph) if edge["outcome"] == "failed")
    assert edge["first_seen"] == "2024-08-18T13:05:25+00:00"
    assert edge["last_seen"] == "2024-08-18T13:06:25+00:00"
    assert all(node["kind"] != "resource" for node in graph["nodes"])
    target = next(node for node in graph["nodes"] if node["kind"] == "service")
    assert target["target_unspecified"] is True
    page = store.connection_events(case_id, edge["id"], limit=1)
    assert page["total"] == 2
    evidence = cases.evidence(case_id, page["items"][0]["event_key"])
    assert evidence["event"] == denied
    assert len(evidence["occurrences"]) == 3
    assert (
        store.connection_events(case_id, edge["id"], limit=1, offset=1)["items"][0]["event_id"]
        == "2"
    )


def test_role_grouping_expansion_and_stable_credential_key(tmp_path):
    without_principal = session()
    without_principal.pop("principalId")
    _, case_id, store = imported(
        tmp_path,
        [
            event(userIdentity=session()),
            event(2, userIdentity=without_principal),
            event(3, userIdentity=session("ASIAOTHER")),
        ],
    )
    identities = store.identities(case_id)["items"]
    assert len(identities) == 1
    assert identities[0]["kind"] == "role"
    assert identities[0]["session_count"] == 2
    assert identities[0]["event_count"] == 3
    expanded = store.identities(case_id, expand_sessions=True)["items"]
    assert len(expanded) == 2
    assert sorted(node["event_count"] for node in expanded) == [1, 2]
    assert all(node["role_id"] == identities[0]["id"] for node in expanded)
    assert "ASIAEXAMPLE" not in json.dumps(expanded)
    assert (
        store.graph(case_id, GraphScope(identity_id=identities[0]["id"], expand_sessions=True))[
            "event_count"
        ]
        == 3
    )


@pytest.mark.parametrize(
    "issuer",
    [
        {},
        {"arn": ROLE, "accountId": "999999999999"},
        {"arn": "arn:aws:iam::999999999999:role/Investigator"},
        {"arn": "arn:aws-cn:iam::123456789012:role/Investigator"},
    ],
)
def test_unverified_issuers_do_not_group(tmp_path, issuer):
    _, case_id, store = imported(
        tmp_path, [event(userIdentity=session(sessionContext={"sessionIssuer": issuer}))]
    )
    node = store.identities(case_id)["items"][0]
    assert node["kind"] == "session"
    assert "role_id" not in node


def test_ambiguous_sessions_and_creation_time_fallback(tmp_path):
    ambiguous = session(None)
    dated = deepcopy(ambiguous)
    dated["sessionContext"]["attributes"] = {"creationDate": "2024-08-18T12:00:00Z"}
    _, case_id, store = imported(
        tmp_path,
        [
            event(userIdentity=ambiguous),
            event(2, userIdentity=ambiguous),
            event(3, userIdentity=dated),
            event(4, userIdentity=dated),
        ],
    )
    role = store.identities(case_id)["items"][0]
    assert role["session_count"] == 1
    assert role["unresolved_session_event_count"] == 2
    expanded = store.identities(case_id, expand_sessions=True)["items"]
    assert len(expanded) == 3
    assert sorted(node["event_count"] for node in expanded) == [1, 1, 2]


def test_accounts_unknown_actors_and_service_domains(tmp_path):
    other = {
        "type": "IAMUser",
        "accountId": "999999999999",
        "arn": "arn:aws:iam::999999999999:user/alice",
        "userName": "alice",
    }
    service = {"type": "AWSService", "invokedBy": "guardduty.amazonaws.com"}
    _, case_id, store = imported(
        tmp_path,
        [
            event(),
            event(2, userIdentity=other),
            event(3, userIdentity={"userName": "alice"}),
            event(4, userIdentity={"userName": "alice"}),
            event(5, userIdentity=service, sourceIPAddress="guardduty.amazonaws.com"),
            event(6, userIdentity=service, sourceIPAddress="guardduty.amazonaws.com"),
        ],
    )
    identities = store.identities(case_id)["items"]
    assert len(identities) == 5
    assert store.identities(case_id, search="ALICE")["total"] == 2
    service_node = next(node for node in identities if node.get("identity_type") == "AWSService")
    graph = store.graph(case_id, GraphScope(identity_id=service_node["id"]))
    assert graph["event_count"] == 2
    assert not any(node["kind"] == "ip" for node in graph["nodes"])
    alice = next(
        node for node in identities if node["account_id"] == ACCOUNT and node["label"] == "alice"
    )
    assert store.graph(case_id, GraphScope(identity_id=alice["id"]))["event_count"] == 1


def test_explicit_targets_sts_role_and_service_qualified_actions(tmp_path):
    resource = {"ARN": "arn:aws:s3:::example-bucket"}
    _, case_id, store = imported(
        tmp_path,
        [
            event(resources=[resource, resource, {"ARN": "bad"}]),
            event(2, resources=[resource], eventSource="other.amazonaws.com"),
            event(
                3,
                eventSource="sts.amazonaws.com",
                eventName="AssumeRole",
                requestParameters={"roleArn": ROLE},
                resources=[{"ARN": ROLE}],
                responseElements={
                    "assumedRoleUser": {
                        "arn": "arn:aws:sts::123456789012:assumed-role/Investigator/new"
                    }
                },
            ),
        ],
    )
    graph = store.graph(case_id)
    assert len(actions(graph)) == 3
    assert sum(edge["event_count"] for edge in actions(graph)) == 3
    assert len([node for node in graph["nodes"] if node["kind"] == "role"]) == 1
    assert not any(node["kind"] == "session" for node in graph["nodes"])
    assert store.identities(case_id)["total"] == 1  # Targets are not observed actors.


def test_time_scope_stable_ids_and_stale_connections(tmp_path):
    _, case_id, store = imported(tmp_path, [event(), event(2, eventTime="2024-08-18T13:06:25Z")])
    graph = store.graph(case_id)
    scope = GraphScope(start="2024-08-18T20:05:25+07:00", end="2024-08-18T13:06:25Z")
    narrowed = store.graph(case_id, scope)
    assert narrowed["event_count"] == 1
    assert [node["id"] for node in narrowed["nodes"]] == [node["id"] for node in graph["nodes"]]
    assert [edge["id"] for edge in narrowed["connections"]] == [
        edge["id"] for edge in graph["connections"]
    ]
    edge = actions(graph)[0]
    assert store.connection_events(case_id, edge["id"], scope)["total"] == 1
    with pytest.raises(KeyError):
        store.connection_events(case_id, edge["id"], GraphScope(start="2025-01-01T00:00:00Z"))
    assert store.graph(case_id, GraphScope(identity_id="missing"))["nodes"] == []


@pytest.mark.parametrize(
    "scope",
    [
        GraphScope(start=""),
        GraphScope(end="invalid"),
        GraphScope(start="2024-08-18T13:05:25"),
        GraphScope(start="2024-08-18T13:05:25Z", end="2024-08-18T13:05:25Z"),
    ],
)
def test_invalid_time_bounds(tmp_path, scope):
    _, case_id, store = imported(tmp_path, [event()])
    with pytest.raises(ValueError):
        store.graph(case_id, scope)


def test_limits_and_scan_beyond_event_page(tmp_path):
    cases, case_id, store = imported(tmp_path, [event(number) for number in range(501)])
    graph = store.graph(case_id)
    assert graph["event_count"] == 501
    assert actions(graph)[0]["event_count"] == 501
    assert (
        store.connection_events(case_id, actions(graph)[0]["id"], limit=500, offset=500)["total"]
        == 501
    )
    for budget in ({"max_events": 500}, {"max_nodes": 2}, {"max_edges": 1}):
        with pytest.raises(ProjectionLimitExceeded):
            RelationshipStore(cases, **budget).graph(case_id)
    for page in ({"limit": 0}, {"limit": 501}, {"offset": -1}):
        with pytest.raises(ValueError):
            store.identities(case_id, **page)
        with pytest.raises(ValueError):
            store.connection_events(case_id, actions(graph)[0]["id"], **page)


def test_cli_relationship_queries(tmp_path, capsys):
    cases, case_id, _ = imported(tmp_path, [event()])
    prefix = ["--data-dir", str(cases.root)]
    assert main([*prefix, "identities", case_id, "--search", "alice"]) == 0
    identity = json.loads(capsys.readouterr().out)["items"][0]
    assert main([*prefix, "graph", case_id, "--identity", identity["id"]]) == 0
    graph = json.loads(capsys.readouterr().out)
    assert main([*prefix, "connection-events", case_id, actions(graph)[0]["id"]]) == 0
    assert json.loads(capsys.readouterr().out)["total"] == 1
    assert main([*prefix, "graph", case_id, "--start", "bad"]) == 1
    assert "timestamp" in capsys.readouterr().err


def test_empty_case_and_identity_pagination(tmp_path):
    _, case_id, store = imported(tmp_path, [])
    assert store.graph(case_id)["event_count"] == 0
    assert store.identities(case_id) == {"total": 0, "items": []}
    _, case_id, store = imported(
        tmp_path, [event(), event(2, userIdentity={"type": "Root", "accountId": ACCOUNT})]
    )
    first = store.identities(case_id, limit=1)
    second = store.identities(case_id, limit=1, offset=1)
    assert first["total"] == second["total"] == 2
    assert first["items"][0]["id"] != second["items"][0]["id"]
    assert store.identities(case_id, offset=2)["items"] == []


def test_multiple_targets_do_not_inflate_case_or_identity_counts(tmp_path):
    bucket = "arn:aws:s3:::example-bucket"
    resources = [{"ARN": bucket}, {"ARN": bucket, "accountId": ACCOUNT}, {"ARN": ROLE}]
    _, case_id, store = imported(tmp_path, [event(resources=resources)])
    graph = store.graph(case_id)
    assert graph["event_count"] == 1
    assert len(actions(graph)) == 2
    assert sum(edge["event_count"] for edge in actions(graph)) == 2
    assert store.identities(case_id)["items"][0]["event_count"] == 1
    assert len([node for node in graph["nodes"] if node["identifier"] == bucket]) == 1


def test_projection_ids_repeat_across_cases_and_input_order(tmp_path):
    records = [event(), event(2, eventTime="2024-08-18T13:06:25Z")]
    _, case_id, store = imported(tmp_path, records)
    first = store.graph(case_id)
    _, case_id, store = imported(tmp_path, list(reversed(records)))
    second = store.graph(case_id)
    assert first["nodes"] == second["nodes"]
    assert first["connections"] == second["connections"]
