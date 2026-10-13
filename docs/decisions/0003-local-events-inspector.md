# 0003: Local HTTP adapter and Events inspector

Implemented on `feature/events-inspector` for PR review, 2026-10-13.

The relationship backend needs a real browser path to stored evidence before graph
rendering. Use FastAPI with Uvicorn for a read-only adapter over `CaseStore` and
`RelationshipStore`. Serve a small HTML/CSS/JavaScript client from the Python package.
React/Vite remains a candidate for a later graph client; this slice needs no frontend
build pipeline or additional browser library. Dependencies are locked in `uv.lock`.

The app factory accepts the case module and optional relationship module, so HTTP
tests use the same interfaces as the CLI. Blocking module calls run in synchronous
route handlers. Query semantics stay in the modules; the adapter owns HTTP validation,
error mapping, serialization and browser response policy.

FastAPI documents [static mounting](https://fastapi.tiangolo.com/tutorial/static-files/)
and [HTTP tests](https://fastapi.tiangolo.com/tutorial/testing/). The implementation
uses those facilities, with a custom JSON response to preserve decimal numbers.

## Run and transport

`cloudtrailblazer --data-dir <case-root> serve --port 8765` binds to `127.0.0.1`.
The CLI exposes no remote bind option and disables forwarded-header interpretation.
One server serves one configured case root. Its browser interface has no import,
delete, arbitrary-file or archive-download operation. Imports still use the CLI.

Host validation allows loopback IP and localhost. Cross-site browser requests and
foreign Origin headers are rejected; no CORS permission is added. Client assets are
local, with a policy restricting scripts/styles/connections to the same origin.
Responses are not cached. This is a local development workbench, with no account,
authentication or hosted multi-user deployment implemented.

## HTTP contract

All endpoints below are GET requests. UUID case IDs and opaque event/connection IDs
refer to the configured root; paths from browser input are never opened directly.

| Route | Result |
| --- | --- |
| `/api/cases` | Paged published-case metadata and a count of unreadable manifests. |
| `/api/cases/{id}` | Import counts, source count, and exact full-case UTC bounds. |
| `/api/cases/{id}/events` | Paged summaries, matching total, and canonical applied UTC bounds. |
| `/api/cases/{id}/events/{key}` | Normalized original JSON text and paged source occurrences. |
| `/api/cases/{id}/identities` | Identity search and pages from the relationship module. |
| `/api/cases/{id}/graph` | Relationship projection, with no rendered-graph claim. |
| `/api/cases/{id}/connections/{key}/events` | Supporting-event pages in the selected scope. |

Page limits are 1..500, default 100 except evidence occurrences (50). Offsets are
nonnegative. Events use start-inclusive/end-exclusive bounds with explicit timezones;
an explicitly empty bound is invalid at the HTTP interface. The browser omits blank
bounds for an open range. Full-case end is one microsecond after the last stored
event, matching DuckDB/Python timestamp precision so the final event remains included.

Evidence returns `event_json` as text. JavaScript parsing and reserializing a numeric
event object could round precise CloudTrail values. The inspector renders/copies this
string without parsing its event numbers. This is normalized original event content;
the stored source snapshot preserves exact bytes. Source ordinals are zero-based
event positions, not JSONL line numbers.

Errors use `{error: {code, message}}`: invalid module requests 400, missing items 404,
unavailable local data 409, projection budgets 413, invalid typed query fields 422.
Database errors do not expose SQL or local paths to the browser. Static content and
unknown routes follow ordinary HTTP status codes. Unsupported write methods are 405.

## Screen and state behavior

The screen follows the reviewed structure: narrow case rail, central Events table,
right evidence inspector and a compact status line. Use matte surfaces, square
controls, thin lines and a full outline for selected rows/controls. Subsequent review
requires a light theme and system sans-serif labels, with monospace for JSON/timestamps.
The inspector stacks below the table on smaller screens; the narrow table can scroll.

Case buttons open summaries/events. Exact time inputs use an explicit Apply control
and Reset restores the case range. Unapplied edits are labeled and never affect
pagination. The table lists UTC time, action, actor locator when available and the
reported outcome. Selection opens evidence without changing scope. Supporting JSON,
source paths, hashes and ordinals are inspectable; JSON has a Copy control.

Each request channel cancels its predecessor and rejects late completions, even if
the transport finishes despite cancellation. Case changes clear selected evidence.
Time changes retain evidence but mark it while scope is pending, outside range, or
unverified after a failed query. UTC comparisons preserve microsecond boundaries.
Loading, empty and error states remain visible; keyboard buttons and source disclosure
controls use native browser behavior. There are no synthetic detections. The later
[Identity focus increment](0004-identity-neighborhood.md) adds graph navigation.

## Verification and remaining work

HTTP tests exercise actual temporary cases, endpoints, error mapping, exact bounds,
decimal preservation, provenance pages, local browser policies and packaged assets.
Client tests cover canceled/late results, actionable errors, microsecond membership
and pagination labels. Manual browser checks cover actual Suzaku samples, denied
evidence, invalid/empty ranges, stale selections, keyboard activation, exact clipboard
text, event/source pagination, case switching and responsive layouts. Synthetic checks are labeled and
kept under `.local/`; they are not performance workloads.

Catalog discovery scans readable manifests on every request. Relationship queries
still rebuild projections. Evidence occurrence pagination bounds its response, while
the module retrieves all occurrences internally. A single event's JSON is not size
bounded. Import jobs, oversized-input limits, cancellation of backend work, benchmarks,
graph layout/grouping, sliders, subgraph windows and detections remain deferred.
