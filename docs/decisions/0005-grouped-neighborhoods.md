# 0005: Grouped neighborhoods and bounded member graphs

2026-10-13. Backend implemented on `feature/grouped-neighborhoods` (PR #5).
The dependent [subgraph window](0006-subgraph-window.md) adds the UI in a separate PR.

The first renderer fails explicitly on dense views. Add presentation groups over the
same scoped projection instead of dropping links or returning an oversized diagram.
Grouping requires one identity and the default grouped-session mode. The raw graph
and connection IDs remain unchanged. No case overview or new identity inference exists.

Group observed source IPs together. Group targets by contacted event service, known
owner, region and member kind. Explicit resources, recorded roles and target-unspecified
service fallbacks stay in separate buckets. A group ID includes identity and bucket
boundaries, never time, search, counts or page offsets. Self-targets remain real members.

Aggregate displayed links by grouped endpoints, relation, contacted service and
reported outcome. Count the union of unique event keys, not sums of member link counts:
one event can mention multiple targets. Expose member count, original connection count
and distinct action count. A one-action link keeps its name; a mixed-action link is
labeled Activity. This is omitted display detail, not a new finding or causal link.
All underlying action names remain on supporting event summaries and raw evidence.

New read-only routes:

| Route | Result |
| --- | --- |
| `/api/cases/{id}/grouped-graph` | Complete grouped neighborhood in the applied identity/time scope. |
| `/api/cases/{id}/groups/{group}` | Searchable member graph page, total matches and full member count. |
| `/api/cases/{id}/grouped-connections/{link}/events` | Supporting event page; child links require their parent `group` query parameter. |

Member search matches label or full locator. Default member page size is 20, with the
normal 1..500 API validation; view/output budgets still apply to that requested page.
Only edges belonging to that group and the visible members enter a member graph.
Its event count and focused identity count describe that page, not the full group.
Evidence IDs depend on member endpoints and parent group, never the page/search,
so a selected member link retrieves the same evidence after reordering or filtering.
Unknown/missing/out-of-time groups return 404. Expanded session mode is rejected.

The existing scan budget bounds work; grouped output uses the existing backend output
budgets. A dense raw view may succeed grouped, while many buckets or services may
still fail explicitly. Projection and grouping are recomputed per query. Grouping
uses event-key sets and a linear member-event index, avoiding a scan of every edge
for every member. It does not bound peak projection memory or prove large-case speed.

Tests cover 61 targets, multi-target events, duplicate occurrences, separate outcomes,
mixed actions, member pages/search, stable child evidence IDs, HTTP/time/identity
validation and service/owner/region/fallback boundaries. Existing UI remains unchanged
in PR #5. The dependent UI increment adds ordered member IDs and refreshed group metadata
to member pages, the single in-app window and grouped fallback.
