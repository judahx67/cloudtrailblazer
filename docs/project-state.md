# Project state

Last updated: 2026-10-13. Latest main checkpoint: `4c049d3` (PRs #2 and #3 merged).
Current increment: `feature/grouped-neighborhoods`, dependent on `feature/identity-graph`
(PR #4). Review/merge #4 first, then retarget the dependent PR to main.

## Current milestone

The next backend slice adds grouped neighborhoods, searchable member graph pages and
grouped supporting-event pages. The browser still uses the first Identity focus UI;
group browsing and the in-app window follow in a separate PR. No PR is auto-merged.

The case/relationship foundation, local Events inspector and first Identity focus
neighborhood are complete. The user
approved the consolidated [graph design](design/graph-workbench.md). Agent guidance
remains in a local, Git-ignored root `AGENTS.md`. Every coding turn now uses a feature
branch and separate PR; the owner reviews before instructing a merge. Branch names
use `feature/`, `fix/`, `docs/`, `cicd/` or another appropriate purpose prefix.

The user pushed the previous state to main. The remote is
`https://github.com/judahx67/cloudtrailblazer.git`; repository-local credential
configuration selects `judahx67`.

Implemented capabilities:

- Import explicit AWS CloudTrail JSON/JSONL and gzip files into durable cases.
- Preserve source bytes/hashes and every occurrence; deduplicate canonical contents
  while retaining conflicting event IDs. Publish only completely imported cases.
- Inspect cases, query bounded event pages with UTC time filtering, and retrieve
  original evidence and source references.
- Search/page observed identities; group verified recorded role issuers, optionally
  expand sessions, and expose missing session discriminators.
- Project stable relationship IDs with service-qualified actions, separate reported
  outcomes, explicit ARN targets and service fallbacks for unspecified targets.
- Focus on an identity, filter by time, and page a connection's supporting events.
  Fail explicitly at configured scan/output budgets.
- Exercise these operations through the development CLI and shared Python modules.
- Discover published cases and expose read-only HTTP queries for cases, events,
  identities, relationship graphs and supporting evidence on loopback.
- Use a real browser Events inspector: case selection, exact UTC bounds, event/source
  pages, normalized original JSON without decimal rounding, source paths/hashes,
  keyboard selection, and visible loading/empty/error/stale-evidence states.
- Serve bundled client assets from the Python wheel, with no frontend build step.
- Use a light-only inspector with system sans-serif labels, monospace JSON/timestamps,
  shared style tokens, visible focus and full-border pastel selection. Copy original
  JSON beside its block or from the inspector header using one shared copy handler.
- Search/page identities by name, ARN or account; inspect a direct SVG neighborhood
  and its full node/connection details. Grouped roles use the existing backend semantics.
- Select connections with pointer or Enter/Space and page only their supporting events
  in the exact time/identity scope, then inspect original JSON/provenance. Supporting
  summaries now carry the same stored actor/account/IP/region fields as the Events table.
- Retain surviving graph positions through time changes. Fail visibly at the prototype
  50-node / 80-connection view budget; no links are silently omitted.

There is no Case overview, dense grouping or Suzaku detection-job integration yet.
Python, DuckDB, FastAPI, Uvicorn, the small JavaScript inspector and SVG neighborhood
are implemented choices. React/Vite and larger-view renderer selection remain proposed.
See the [Identity focus decision](decisions/0004-identity-neighborhood.md), the
[relationship decision](decisions/0002-relationship-projection.md) and
[HTTP/inspector decision](decisions/0003-local-events-inspector.md) for the contracts.

## Validation

Verification on 2026-10-13:

- All 60 Python tests passed, including four new grouping/HTTP regressions.
  Existing evidence/identity semantics and new discovery, pagination, exact full-case
  bounds, decimal text, typed errors, read-only/local policies and assets are checked.
- All 10 client tests passed, including late/canceled results, late network errors,
  actionable HTTP errors, exact microsecond scope membership, page labels, complete
  directed links, stable surviving layout, explicit view budgets and self-target loops.
- Ruff lint and formatting checks passed.
- The light-theme increment also passed JavaScript syntax checking and all existing
  Python/client tests. Browser checks confirmed both copy controls match the full
  displayed JSON exactly, support Enter and disable when evidence clears. Text contrast
  against the main surface: 14.4:1 primary, 6.3:1 muted, 7.1:1 warning. Focus outlines
  remain visible, and controls meet a 24px minimum height. At 430px there was no document
  overflow with populated evidence. No browser console warnings/errors were recorded.
  These are targeted checks, not a full accessibility audit; screen-reader and browser
  zoom verification remain open.
- The wheel built successfully with all seven client assets and no local cases,
  environments, caches or upstream checkout included.
- Manual browser verification used all 33 pinned Suzaku AWS events. The denied
  DeleteTrail event opened its AccessDenied JSON and original source/hash/ordinal.
  Empty and invalid ranges, stale evidence, Reset, keyboard selection, exact JSON
  clipboard copying, case switching,
  56-event/25-occurrence synthetic pagination, and unapplied time edits were checked.
  Responsive checks at 920px and 430px had no document-width overflow; the narrow
  event table scrolls horizontally. The browser console showed no errors/warnings.
- Graph QA verified search, node and connection keyboard selection, service fallback
  details, exact denied-event evidence/copying, retained stale evidence, exclusive/empty/
  invalid ranges and view/case changes. Labeled synthetic checks verified 23-identity
  pages, 56-event connection pages and an explicit dense-view error. Populated graph
  and supporting evidence had no page overflow at 920px and 430px; the narrow diagram
  scrolls inside its panel. SVG focus rectangles use a visible 3px stroke. No console
  warnings/errors were recorded. Full screen-reader and zoom audits remain open.

The upstream fixture test skips when its external checkout is absent; it ran here.
Tests required normal Windows path access because the sandbox denies strict resolution
of workspace fixtures. Temporary cases and smoke-test outputs stayed under `.local/`.
Initial small-sample measurements scan the pinned 33 events and project TrailDiscover's
4 events / 3 nodes / 8 links. Five warm module runs: median 12.38 ms, max 12.62 ms.
Five browser runs: HTTP query/decode 16.6–17.4 ms, layout 0–0.2 ms and DOM creation
0.3–0.5 ms. Paint, input latency, peak memory, import costs and representative larger
workloads remain unmeasured; these numbers establish no large-case performance claim.
The test run emitted one upstream TestClient/HTTPX deprecation warning. HTTPX is a
development dependency; follow the framework's test-client transition in a later
dependency maintenance increment. The build warned about the project-local uv cache;
wheel inspection confirmed it is excluded.

The local preview runs on `http://127.0.0.1:8765`, reading `.local/preview-cases`.
It includes the pinned sample case and clearly labeled synthetic/empty/graph-paging checks.
The current screenshot is `.local/identity-graph.jpg`; preview data and images are ignored.

The earlier hypothetical UI comparison demonstrated design interactions only. Its
middle-dot separators and left-edge accents are superseded by the current visual rules.
The earlier dark surface and all-monospace labels are also superseded: the user's
latest direction requires a professional light theme, reusable UI elements and
accessibility considered in every UI increment.

## Known limitations and open decisions

- Imports are synchronous and create new cases; append/edit, jobs,
  Parquet, oversized-input budgets and interrupted-process recovery are deferred.
- Cases are read-only through the module, not tamper-proof archives. Source copying
  adds disk cost; per-record inserts have not been benchmarked.
- Each relationship query recomputes its projection. The scan budget bounds event
  count; graph budgets bound output after projection, not peak memory. Identity and
  evidence pagination do not yet avoid the full scoped scan.
- Target extraction supports recorded resource ARNs and STS request roleArn only.
  Missing issuers are not enriched from other records; creation time is a weaker
  session discriminator. No AssumeRole response-to-session causal link is inferred.
- The catalog scans manifests per request. Evidence occurrence pages bound response
  size, while the module still loads all occurrence references internally; a single
  event's JSON has no size budget. Browser aborts discard stale results without
  canceling already running backend work.
- Import is CLI-only. No event search/action filter, two-handle time slider,
  density grouping, session expansion controls, graph Expand, pan/zoom, Case overview
  or subgraph navigation exists yet. Dense neighborhoods can exceed the small prototype
  view budget even when backend projection succeeds. Positions retained across repeated
  time changes can leave empty lanes; a deliberate new focus resets that history.
- The wrapper distribution/license decision remains open; upstream Suzaku uses AGPLv3.
- `AGENTS.md` is ignored now but remains in earlier commits; ignoring does not erase history.
- No new blocker prevents the next increment.

## Recommended next increment

After reviewing this PR, flesh out dense-neighborhood grouping and browsing so the
prototype's view limit becomes a navigable resource group. Preserve service/outcome
semantics, accurate counts and the evidence path; define group selection and paging
before adding the subgraph window. Benchmark representative larger and skewed workloads
before selecting the broader renderer or increasing budgets. Session expansion, Case
overview, the time slider and subgraph window remain focused increments. Detection
focus follows real Suzaku integration.

## Milestone history

| Date | Step | Outcome |
| --- | --- | --- |
| 2026-10-13 | Upstream inspection and project shape | Pinned Suzaku and rules; documented architecture and visual direction. |
| 2026-10-13 | Case foundation (`20cec7a`) | Durable imports, queries, evidence, locked dependencies and 21 passing tests. |
| 2026-10-13 | Agent anchor and reporting | Local anchor and project-state document with milestone reporting requirements. |
| 2026-10-13 | Repository identity | Configured judahx67 and kept AGENTS.md local and ignored. |
| 2026-10-13 | Graph interview (`292b522`) | Consolidated interaction design; subsequently approved by the user and pushed to main. |
| 2026-10-13 | Relationship backend (`4db6da6`, merged `fd88250`) | Identity/session projection, graph/evidence queries, CLI, contract and 40 passing tests. PR #1 merged; branch renamed to feature/relationships. |
| 2026-10-13 | Local Events inspector (`8ccefcd`, merged `437cdc0`) | Read-only HTTP adapter, packaged browser inspector, exact scopes and provenance; 55 Python and 6 client tests, browser QA and wheel verification. PR #2 merged. |
| 2026-10-13 | Light workbench (`5757ac3`, merged `4c049d3`) | Light-only shared tokens, system sans-serif UI, stronger contrast, reusable Copy control and updated agent/design rules. PR #3 merged. |
| 2026-10-13 | Identity neighborhood (`feature/identity-graph`) | Search/paging, SVG neighborhood, stable positions, full details and scoped supporting events in shared inspector; 56 Python and 10 client tests, browser QA, packaging and initial small-sample measurements. PR review. |
| 2026-10-13 | Grouped neighborhood backend (`feature/grouped-neighborhoods`) | Stable group/member links, unique counts and bounded member/evidence pages; 60 Python tests and 10 client tests. Dependent PR for review; UI follows separately. |
