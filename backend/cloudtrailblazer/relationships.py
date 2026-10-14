"""Evidence-backed relationships, independent of graph rendering and layout."""

import hashlib
from contextlib import closing
from dataclasses import dataclass, field
from ipaddress import ip_address

import simplejson as json

from cloudtrailblazer.cases import CaseStore


class ProjectionLimitExceeded(ValueError):
    """The query cannot be returned completely within the configured work/view budget."""


@dataclass(frozen=True)
class GraphScope:
    start: str | None = None
    end: str | None = None
    identity_id: str | None = None
    expand_sessions: bool = False


DEFAULT_SCOPE = GraphScope()


def _text(value) -> str | None:
    return value if isinstance(value, str) and value else None


def _object(value) -> dict:
    return value if isinstance(value, dict) else {}


def _id(kind: str, *parts) -> str:
    data = json.dumps([kind, *parts], separators=(",", ":"), ensure_ascii=False)
    return kind + ":" + hashlib.sha256(data.encode("utf-8")).hexdigest()


def _arn(value) -> list[str] | None:
    text = _text(value)
    parts = text.split(":", 5) if text else []
    if len(parts) == 6 and parts[0] == "arn" and parts[1] and parts[2] and parts[5]:
        return parts
    return None


def _node(
    kind: str,
    identifier: str,
    *,
    account: str | None = None,
    key: str | None = None,
    label: str | None = None,
    **metadata,
) -> dict:
    return {
        "id": key or _id(kind, account, identifier),
        "kind": kind,
        "identifier": identifier,
        "label": label or identifier,
        "account_id": account,
        **metadata,
    }


def _resource(value, owner=None) -> dict | None:
    parts = _arn(value)
    if not parts:
        return None
    is_role = (
        parts[2] == "iam" and parts[3] == "" and bool(parts[4]) and parts[5].startswith("role/")
    )
    kind = "role" if is_role else "resource"
    account = parts[4] or _text(owner)
    # An ARN is the resource locator. Optional owner metadata must not split the same ARN.
    key = _id("role", parts[4], value) if is_role else _id("resource", value)
    return _node(
        kind,
        value,
        account=account,
        key=key,
        label=parts[5].rsplit("/", 1)[-1],
        service=parts[2],
        region=parts[3] or None,
    )


def _actor(event: dict, event_key: str) -> tuple[dict, dict | None]:
    identity = _object(event.get("userIdentity"))
    identity_type = _text(identity.get("type")) or "Unknown"
    arn = _text(identity.get("arn"))
    parts = _arn(arn)
    account = _text(identity.get("accountId")) or (parts[4] if parts else None)
    context = _object(identity.get("sessionContext"))
    if identity_type == "AssumedRole":
        # Session names/ARNs can be reused. Prefer a credential discriminator, then
        # recorded creation time; without either, do not merge separate records.
        discriminator = _text(identity.get("accessKeyId"))
        resolution = "credential" if discriminator else "creation_time"
        discriminator = discriminator or _text(
            _object(context.get("attributes")).get("creationDate")
        )
        if discriminator is None:
            discriminator, resolution = event_key, "event_scoped"
        session = _node(
            "session",
            arn or _text(identity.get("principalId")) or "Unresolved session",
            account=account,
            key=_id(
                "session",
                account,
                arn or _text(identity.get("principalId")),
                resolution,
                discriminator,
            ),
            label=arn.rsplit("/", 1)[-1] if arn else "Unresolved session",
            identity_type=identity_type,
            resolution=resolution,
        )
        issuer = _object(context.get("sessionIssuer"))
        issuer_arn = _text(issuer.get("arn"))
        issuer_parts = _arn(issuer_arn)
        role = _resource(issuer_arn)
        if (
            role
            and role["kind"] == "role"
            and parts
            and issuer_parts
            and parts[2] == "sts"
            and parts[5].startswith("assumed-role/")
            and parts[1] == issuer_parts[1]
            and parts[4] == account == issuer_parts[4]
            and (not issuer.get("accountId") or issuer["accountId"] == account)
        ):
            session["role_id"] = role["id"]
            session["role_arn"] = role["identifier"]
            return session, role
        return session, None
    if parts:
        role = _resource(arn)
        if identity_type == "Role" and role and role["kind"] == "role" and account == parts[4]:
            return role, None
        return _node(
            "identity",
            arn,
            account=account,
            label=_text(identity.get("userName")) or parts[5].rsplit("/", 1)[-1],
            identity_type=identity_type,
        ), None
    behalf = _object(identity.get("onBehalfOf"))
    locator = None
    if _text(behalf.get("userId")) and _arn(behalf.get("identityStoreArn")):
        locator = json.dumps([behalf["identityStoreArn"], behalf["userId"]])
    elif identity_type == "AWSService" and _text(identity.get("invokedBy")):
        locator = identity["invokedBy"]
        account = account or _text(event.get("recipientAccountId"))
    elif account and _text(identity.get("principalId")):
        locator = identity["principalId"]
    elif account and identity_type in {"Root", "AWSAccount"}:
        locator = identity_type
    if locator:
        return _node(
            "identity",
            locator,
            account=account,
            key=_id("identity", identity_type, account, locator),
            label=_text(identity.get("userName")) or locator,
            identity_type=identity_type,
        ), None
    return _node(
        "identity",
        "Unresolved actor",
        account=account,
        key=_id("unknown", event_key),
        identity_type=identity_type,
        resolution="event_scoped",
    ), None


def _targets(event: dict) -> list[dict]:
    targets = {}
    resources = event.get("resources")
    for record in resources if isinstance(resources, list) else []:
        record = _object(record)
        node = _resource(record.get("ARN") or record.get("arn"), record.get("accountId"))
        if node:
            targets[node["id"]] = node
    if event["eventSource"] in {"sts.amazonaws.com", "sts.amazonaws.com.cn"} and event[
        "eventName"
    ] in {"AssumeRole", "AssumeRoleWithSAML", "AssumeRoleWithWebIdentity"}:
        role = _resource(_object(event.get("requestParameters")).get("roleArn"))
        if role and role["kind"] == "role":
            targets[role["id"]] = role
    if targets:
        return list(targets.values())
    source = event["eventSource"]
    account = _text(event.get("recipientAccountId"))
    region = _text(event.get("awsRegion"))
    return [
        _node(
            "service",
            source,
            account=account,
            key=_id("service", account, region, source),
            label=source.split(".")[0],
            region=region,
            target_unspecified=True,
        )
    ]


@dataclass
class _Projection:
    nodes: dict = field(default_factory=dict)
    edges: dict = field(default_factory=dict)
    events: dict = field(default_factory=dict)
    actor_events: dict = field(default_factory=dict)
    node_events: dict = field(default_factory=dict)
    sessions: dict = field(default_factory=dict)
    uncertain_sessions: dict = field(default_factory=dict)
    scanned: int = 0

    def add_node(self, node: dict, row: dict):
        self.nodes.setdefault(node["id"], node)
        self.node_events.setdefault(node["id"], set()).add(row["event_key"])

    def connect(self, source: dict, target: dict, kind: str, row: dict):
        key = _id(
            "connection",
            source["id"],
            target["id"],
            kind,
            row["event_source"],
            row["event_name"],
            row["outcome"],
        )
        self.add_node(source, row)
        self.add_node(target, row)
        edge = self.edges.setdefault(
            key,
            {
                "id": key,
                "source": source["id"],
                "target": target["id"],
                "kind": kind,
                "service": row["event_source"],
                "action": row["event_name"],
                "outcome": row["outcome"],
                "_events": set(),
            },
        )
        edge["_events"].add(row["event_key"])

    def stats(self, event_keys: set) -> dict:
        times = [self.events[key]["event_time"] for key in event_keys]
        return {"event_count": len(event_keys), "first_seen": min(times), "last_seen": max(times)}

    def node(self, key: str, event_keys: set | None = None) -> dict:
        return {
            **self.nodes[key],
            **self.stats(event_keys if event_keys is not None else self.node_events[key]),
            "session_count": len(self.sessions.get(key, set())),
            "unresolved_session_event_count": len(self.uncertain_sessions.get(key, set())),
        }


class RelationshipStore:
    """Raw/grouped views, identity navigation and their supporting-event pages.

    Stable IDs do not depend on time/ordering. All queries rebuild from immutable
    case contents; no derived schema or cache is introduced in this first increment.
    Large projections fail explicitly rather than silently truncating relationships.
    """

    def __init__(self, cases: CaseStore, *, max_events=100_000, max_nodes=500, max_edges=1_500):
        if min(max_events, max_nodes, max_edges) < 1:
            raise ValueError("Projection budgets must be positive")
        self.cases = cases
        self.max_events, self.max_nodes, self.max_edges = max_events, max_nodes, max_edges

    def _project(self, case_id: str, scope: GraphScope) -> _Projection:
        projection = _Projection()
        with closing(self.cases.iter_events(case_id, start=scope.start, end=scope.end)) as rows:
            for row in rows:
                projection.scanned += 1
                if projection.scanned > self.max_events:
                    raise ProjectionLimitExceeded("Scan budget exceeded; narrow the time range")
                event = row.pop("event")
                session, role = _actor(event, row["event_key"])
                actor = role if role and not scope.expand_sessions else session
                if scope.identity_id and scope.identity_id not in {
                    actor["id"],
                    session["id"],
                    role["id"] if role else None,
                }:
                    continue
                projection.events[row["event_key"]] = row
                projection.add_node(actor, row)
                projection.actor_events.setdefault(actor["id"], set()).add(row["event_key"])
                if session["kind"] == "session":
                    if session["resolution"] == "event_scoped":
                        projection.uncertain_sessions.setdefault(actor["id"], set()).add(
                            row["event_key"]
                        )
                    else:
                        projection.sessions.setdefault(actor["id"], set()).add(session["id"])
                source_address = _text(event.get("sourceIPAddress"))
                try:
                    address = str(ip_address(source_address)) if source_address else None
                except ValueError:
                    address = None
                if address:
                    source = _node("ip", address)
                    projection.connect(source, actor, "observed_source", row)
                for target in _targets(event):
                    projection.connect(actor, target, "action", row)
        return projection

    def graph(self, case_id: str, scope: GraphScope = DEFAULT_SCOPE) -> dict:
        projection = self._project(case_id, scope)
        if len(projection.nodes) > self.max_nodes or len(projection.edges) > self.max_edges:
            raise ProjectionLimitExceeded(
                "Graph budget exceeded; select an identity or narrow time"
            )
        edges = []
        for key in sorted(projection.edges):
            edge = projection.edges[key]
            edges.append(
                {
                    **{k: v for k, v in edge.items() if k != "_events"},
                    **projection.stats(edge["_events"]),
                }
            )
        return {
            "schema_version": 1,
            "case_id": case_id,
            "scope": {
                "start": scope.start,
                "end": scope.end,
                "identity_id": scope.identity_id,
                "expand_sessions": scope.expand_sessions,
            },
            "event_count": len(projection.events),
            "scanned_event_count": projection.scanned,
            "nodes": [projection.node(key) for key in sorted(projection.nodes)],
            "connections": edges,
        }

    def identities(
        self,
        case_id: str,
        *,
        start=None,
        end=None,
        expand_sessions=False,
        search="",
        limit=100,
        offset=0,
    ) -> dict:
        self._page(limit, offset)
        projection = self._project(case_id, GraphScope(start, end, expand_sessions=expand_sessions))
        nodes = [
            projection.node(key, event_keys) for key, event_keys in projection.actor_events.items()
        ]
        nodes = [
            node
            for node in nodes
            if search.casefold()
            in " ".join([node["label"], node["identifier"], node["account_id"] or ""]).casefold()
        ]
        nodes.sort(key=lambda node: (node["label"].casefold(), node["id"]))
        return {"total": len(nodes), "items": nodes[offset : offset + limit]}

    def _grouped(
        self,
        projection: _Projection,
        scope: GraphScope,
        group_id=None,
        members=None,
        build_nodes=True,
    ):
        """Collapse presentation only; every link keeps its unique underlying event set."""
        if not scope.identity_id or scope.expand_sessions:
            raise ValueError("Grouped neighborhoods require one identity with grouped sessions")
        buckets = {}
        routes = []
        member_events = {}
        for edge in projection.edges.values():
            incoming = edge["kind"] == "observed_source"
            member = projection.nodes[edge["source"] if incoming else edge["target"]]
            parts = (
                "source" if incoming else "target",
                None if incoming else edge["service"],
                None if incoming else member["account_id"],
                None if incoming else member.get("region"),
                "ip" if incoming else member["kind"],
            )
            key = _id("group", scope.identity_id, *parts)
            bucket = buckets.setdefault(key, {"parts": parts, "members": set(), "events": set()})
            bucket["members"].add(member["id"])
            bucket["events"].update(edge["_events"])
            routes.append((edge, key, member["id"]))
            member_events.setdefault((key, member["id"]), set()).update(edge["_events"])
        if group_id and group_id not in buckets:
            raise KeyError("Group not found in the selected scope")
        nodes = {}
        if scope.identity_id in projection.nodes:
            nodes[scope.identity_id] = projection.node(scope.identity_id)
        if group_id and build_nodes:
            for key in buckets[group_id]["members"] if members is None else members:
                if key != scope.identity_id:
                    nodes[key] = projection.node(key, member_events[group_id, key])
        elif not group_id and build_nodes:
            for key, bucket in buckets.items():
                kind, service, account, region, member_kind = bucket["parts"]
                count = len(bucket["members"])
                label = "Source IPs" if kind == "source" else service.split(".")[0]
                nodes[key] = {
                    **_node("group", label, key=key, label=f"{label}: {count}", account=account),
                    **projection.stats(bucket["events"]),
                    "group_type": kind,
                    "service": service,
                    "region": region,
                    "member_kind": member_kind,
                    "member_count": count,
                    "target_unspecified": member_kind == "service",
                }
        edges = {}
        for original, bucket, member in routes:
            if group_id and (bucket != group_id or (members is not None and member not in members)):
                continue
            incoming = original["kind"] == "observed_source"
            endpoint = member if group_id else bucket
            source, target = (
                (endpoint, scope.identity_id) if incoming else (scope.identity_id, endpoint)
            )
            key = _id(
                "group_connection",
                scope.identity_id,
                group_id,
                source,
                target,
                original["kind"],
                original["service"],
                original["outcome"],
            )
            edge = edges.setdefault(
                key,
                {
                    "id": key,
                    "source": source,
                    "target": target,
                    "kind": original["kind"],
                    "service": original["service"],
                    "outcome": original["outcome"],
                    "_events": set(),
                    "_actions": set(),
                    "member_connection_count": 0,
                },
            )
            edge["_events"].update(original["_events"])
            edge["_actions"].add(original["action"])
            edge["member_connection_count"] += 1
        return buckets, nodes, edges

    def _group_view(self, case_id, scope, projection, nodes, edges):
        if len(nodes) > self.max_nodes or len(edges) > self.max_edges:
            raise ProjectionLimitExceeded("Grouped graph budget exceeded; narrow the time range")
        connections = []
        for key in sorted(edges):
            edge = edges[key]
            actions = edge["_actions"]
            connections.append(
                {
                    **{key: value for key, value in edge.items() if not key.startswith("_")},
                    **projection.stats(edge["_events"]),
                    "action": next(iter(actions)) if len(actions) == 1 else "Activity",
                    "action_count": len(actions),
                    "grouped": True,
                }
            )
        event_keys = set().union(*(edge["_events"] for edge in edges.values()))
        if scope.identity_id in nodes:
            nodes[scope.identity_id] = {
                **nodes[scope.identity_id],
                **(
                    projection.stats(event_keys)
                    if event_keys
                    else {"event_count": 0, "first_seen": None, "last_seen": None}
                ),
            }
        return {
            "schema_version": 1,
            "case_id": case_id,
            "scope": {
                "start": scope.start,
                "end": scope.end,
                "identity_id": scope.identity_id,
                "expand_sessions": False,
            },
            "event_count": len(event_keys),
            "scanned_event_count": projection.scanned,
            "nodes": [nodes[key] for key in sorted(nodes)],
            "connections": connections,
        }

    def grouped_graph(self, case_id: str, scope: GraphScope) -> dict:
        projection = self._project(case_id, scope)
        _, nodes, edges = self._grouped(projection, scope)
        return self._group_view(case_id, scope, projection, nodes, edges)

    def group_page(
        self, case_id: str, group_id: str, scope: GraphScope, *, search="", limit=20, offset=0
    ) -> dict:
        self._page(limit, offset)
        projection = self._project(case_id, scope)
        buckets, groups, _ = self._grouped(projection, scope)
        if group_id not in buckets:
            raise KeyError("Group not found in the selected scope")
        ids = sorted(
            buckets[group_id]["members"],
            key=lambda key: (projection.nodes[key]["label"].casefold(), key),
        )
        ids = [
            key
            for key in ids
            if search.casefold()
            in (
                projection.nodes[key]["label"] + " " + projection.nodes[key]["identifier"]
            ).casefold()
        ]
        page = ids[offset : offset + limit]
        _, nodes, edges = self._grouped(projection, scope, group_id, set(page))
        return {
            "group_id": group_id,
            "group": groups[group_id],
            "total": len(ids),
            "member_count": len(buckets[group_id]["members"]),
            "member_ids": page,
            "graph": self._group_view(case_id, scope, projection, nodes, edges),
        }

    def grouped_connection_events(
        self,
        case_id: str,
        connection_id: str,
        scope: GraphScope,
        *,
        group_id=None,
        limit=100,
        offset=0,
    ) -> dict:
        self._page(limit, offset)
        projection = self._project(case_id, scope)
        _, _, edges = self._grouped(projection, scope, group_id, build_nodes=False)
        if connection_id not in edges:
            raise KeyError("Grouped connection not found in the selected scope")
        rows = [projection.events[key] for key in edges[connection_id]["_events"]]
        rows.sort(key=lambda row: (row["event_time"], row["event_key"]))
        return {"total": len(rows), "items": rows[offset : offset + limit]}

    def connection_events(
        self,
        case_id: str,
        connection_id: str,
        scope: GraphScope = DEFAULT_SCOPE,
        *,
        limit=100,
        offset=0,
    ) -> dict:
        self._page(limit, offset)
        projection = self._project(case_id, scope)
        edge = projection.edges.get(connection_id)
        if edge is None:
            raise KeyError("Connection not found in the selected scope")
        rows = [projection.events[key] for key in edge["_events"]]
        rows.sort(key=lambda row: (row["event_time"], row["event_key"]))
        return {"total": len(rows), "items": rows[offset : offset + limit]}

    @staticmethod
    def _page(limit: int, offset: int):
        if not 1 <= limit <= 500 or offset < 0:
            raise ValueError("limit must be 1..500 and offset must be nonnegative")
