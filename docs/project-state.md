# Project state

Last updated: 2026-10-15. Latest main checkpoint: `e1f73e5` (PRs #13–#16 reached main).
Neutral white/gray surfaces, subtle blue selection and quieter borders are the
owner-selected baseline. PR #12 was closed because #11 was sufficient.
Current increment: `fix/graph-workspace-space`, dependent on activity search PR #17.
The graph fills remaining panel height; identity selection collapses its picker,
Find activity opens search on demand, and the connection list expands separately.
Activity search is implemented on `feature/activity-search`, based on main. Security
investigation is the owner-selected primary workflow; cloud-admin troubleshooting
is a secondary use of the same tools. The first increment adds a clue-based Events
search with recorded-outcome filtering and original evidence access.
No PR is auto-merged.

## Current milestone

Resizable panels, automatic identity scrolling, tab-wide subgraph placement and compact
controls are on main. The merged styling pass separates quiet section lines from
functional boundaries, removes repetitive inactive list-item frames and clarifies
surface/type hierarchy. No investigation behavior or backend changes are introduced.
PRs #13–#16 are merged: the time slider, clearer identity choices, dense-graph fix,
adjustable columns and Follow trail are now on main. The dense-graph fix
fixes rejection of valid dense grouped graphs: the 50-node/80-link detail threshold
now triggers grouping, while rendering accepts the existing 500-node/1,500-link
server ceiling. Column controls fill available horizontal graph space and
allow bounded movement/width changes in main and child diagrams.
Follow trail now isolates a node’s direct neighbors or a single connection and
its endpoints, with a Full neighborhood return and unchanged evidence routes.
Group fallback runs once; every returned relationship remains visible
through scrolling and keeps its evidence path.

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
- Retain surviving graph positions through time changes. Above the prototype
  50-node / 80-connection detail threshold, retry a grouped neighborhood; remaining budget
  failures stay visible and no returned links are silently omitted.
- Group targets by service, owner, region and kind; group observed source IPs.
  Preserve unique event/member counts, reported outcomes and full supporting evidence.
- Open one non-modal subgraph window with a parent breadcrumb, 20-member paging and
  explicit search. Inspect child nodes/connections in the common inspector, move/resize
  with keyboard alternatives and return with Back/Close/Escape. Global time changes
  refresh the child and reset its paging; changing case/view/focus closes it.
- Resize adjacent panels with captured pointer gestures or accessible separator
  Arrow/Home/End controls. Responsive modes have independent tab-local sizes and
  Reset layout. Drag the subgraph header or Move; header buttons do not start dragging.
- Focus scroll regions directly to use native keyboard scrolling for overflowing
  cases, identities, event tables, member diagrams and evidence.
- Scroll identity results to append bounded pages automatically, preserving selected
  rows and graph state. Search/time/case/view changes reset loading and discard stale
  results. Counts show loaded/total; errors retain rows and can be retried by scrolling.
- Move the subgraph window anywhere across the visible tab, outside scrolling panels,
  with viewport clamping and accessible Close. Compact upper controls leave more graph
  space; identity scrolling remains available in a 120px region.
- First visual-polish pass: neutral gray case/header surfaces and white workspaces,
  pale blue full-border selection, quieter inactive navigation/list choices, distinct
  control-boundary tokens and centered divider grips. This visual baseline was confirmed by the owner.
- Adjust global time with two native range handles: preview exact UTC fields while
  dragging, apply on release or keyboard change, clamp crossing at one microsecond,
  and reset to full case bounds. Exact/open/out-of-case field queries remain available
  through Apply; invalid or out-of-case drafts disable slider interaction. Empty cases
  show no timed range. On narrow panels, the slider moves below the fields.
- Identify identity/member choices by a visible four-border button surface and accent
  label; event action buttons are underlined.
- Fill available graph width with Source IPs, Identity and Targets columns. Drag
  a column header to move it or Width to resize it; Left/Right and Home/End offer
  keyboard alternatives. Columns stay ordered and separated, links remain attached,
  and node labels use the available width. Reset columns restores automatic sizing;
  Reset layout resets both diagrams. Main/child settings are independent and tab-local.
- Hover, keyboard-focus or select a node/connection to prepare Follow trail. Activate
  it to isolate direct incident links for a node or exactly one link and its endpoints.
  Counts use the selected item’s unique supporting-event count, not summed link counts.
  Return to Full neighborhood restores the original diagram; scope/focus/case/member
  refresh clears the local trail. This does not traverse beyond the loaded neighborhood.
- Find activity using case-insensitive literal JSON text (action, IP, ARN, resource,
  event ID or another recorded string) and an optional recorded-outcome filter. Search
  opens Events within applied time bounds, resets paging and clears old selection.
  Draft/applied filters are explicit; graph scopes and supporting-event queries remain
  independent. Counts/pages preserve deduplication and original provenance.
- Prepare two pinned public corpora locally with byte/hash/archive/nesting checks,
  without replaying attacks, executing accompanying files or following log URLs.
  See [the corpus guide](testing/cloudtrail-datasets.md) for provenance and commands.

There is no Case overview or Suzaku detection-job integration yet.
Python, DuckDB, FastAPI, Uvicorn, the small JavaScript inspector and SVG neighborhood
are implemented choices. React/Vite and larger-view renderer selection remain proposed.
See the [Identity focus decision](decisions/0004-identity-neighborhood.md), the
[relationship decision](decisions/0002-relationship-projection.md) and
[HTTP/inspector decision](decisions/0003-local-events-inspector.md) for the contracts.

## Validation

Compact workspace increment: 69 Python tests and 40 client tests pass; Ruff lint
and formatting pass. Browser checks retain all 214 nodes and 233 connection buttons
for cloudmapper in the public Splunk case. The diagram is 896px tall at the default
1146x1244 viewport, replacing its former 390px cap. Identity and connection
disclosures reopen with Enter; Find activity toggles visibly. At 430px width the
document has no horizontal overflow. These are targeted layout checks, not an
accessibility audit or a large-data performance claim.

Latest verification on 2026-10-15 (earlier browser measurements below remain historical):

- Activity-search regressions verify literal wildcards/SQL-like input, case matching,
  nested values, outcomes, exclusive time bounds, paging totals, conflicting event IDs
  and duplicate-source provenance; HTTP validation rejects invalid outcomes/long text.
  Browser checks locate the denied DeleteTrail record with original JSON and source,
  distinguish drafts from applied filters, clear/reset empty results, and intersect IP
  searches with exact time bounds. Identity view retained its time-only scope;
  populated 430px reflow had no document overflow or page console warnings/errors.
- Trail checks: direct neighbors, separate outcomes, self-loops, exact evidence IDs,
  non-summed counts, missing targets and reset/return behavior. Browser checks confirm
  keyboard focus only prepares the action, a connection isolates 2 nodes/1 link with
  source evidence, a node isolates 2 nodes/4 links, Full neighborhood restores 3/8,
  and Reset clears the trail. At 430px there was no page overflow; console was clear.
  Native hover behavior and the broader accessibility audit remain manual.
- Graph-column checks: automatic wide-panel sizing, constrained movement/width,
  custom reflow on shrink, pointer capture/release, keyboard controls and reset.
  Browser checks used the 214-node/233-link public-log graph at 1800px and 430px;
  selection survived geometry updates and child controls worked independently.
  No document-width overflow or console warnings/errors. Native dragging remains a
  manual check; redraw cost and paint/input latency are not benchmarked.
- Dense graph regression: reproduced the public Splunk cloudmapper window at
  2021-04-13T10:33:15 through 17:15:02.000001 UTC. Its 377 unique events yield
  241 raw nodes/329 links and 214 grouped nodes/233 links. The old renderer rejected
  the grouped response; the new browser renders all 214/233, supports keyboard
  scrolling to the last row, group drill-down and exact event/source inspection.
  One run measured 123ms query/decode and 7.4ms combined layout/DOM; module queries
  measured 52.76ms raw and 56.87ms grouped. These are single observations, not paint,
  memory, input-latency or worst-case guarantees. Regression tests cover complete
  dense output, hard-ceiling rejection and one grouped request per fallback.
- Time-slider checks: native Arrow/Home/End updates, repeated tick movement, compact
  fields, invalid drafts, Reset, empty and one-microsecond cases, stale evidence and
  4,196-record public-log scope updates. At 430px there was no document-width overflow.
  New client tests verify offset/pre-epoch conversion, exact endpoint preservation,
  crossing clamps and preview-versus-commit behavior. Native pointer dragging and
  Firefox styling remain manual/unverified; screen-reader and zoom audits remain open.

- All 69 Python tests passed, including duplicate archive rejection before extraction,
  valid optional-directory layouts, corpus hash/nesting/archive-link regressions,
  grouping/HTTP and self-target members.
  Existing evidence/identity semantics and new discovery, pagination, exact full-case
  bounds, decimal text, typed errors, read-only/local policies and assets are checked.
- All 40 client tests passed, including tab-wide geometry/viewport shrink, scroll-loader serialization, stale success/error
  resets, retained page/retry offsets and empty/end states, evidence-divider keyboard/
  pointer direction parity in wide/medium/narrow layouts, pointer capture/cancellation, header dragging,
  panel minimum space/reset/responsive modes, window containment, source group layout,
  typed projection errors, late/canceled results, late network errors,
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
- The wheel built successfully with all fifteen client assets and no local cases,
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
- Group browser QA used a clearly labeled synthetic case with 61 resource targets,
  two IPs, mixed actions and separate reported outcomes. Verified grouped fallback,
  ordered member pages/search, exact child connection evidence/copying, source groups,
  invalid/empty/reset scope states, parent keyboard focus after Escape, Move/Resize
  Arrow keys, one-window replacement and closure on view changes. At 920px/430px the
  window remained inside its stage without document-width overflow. Pointer dragging
  and native corner resizing still need manual QA; the available browser automation
  exposes semantic keyboard actions. No new console warnings/errors were recorded.
- Latest browser checks exercised the real 4,196-record Splunk case, event paging
  and independent table scrolling, exact JSON copy, desktop width/tablet height/phone
  height resizing, and dense member scrolling. A labeled 438-event/120-identity fixture
  covers long names, identity page boundaries and a 16,669-character JSON record.
  Hostile markup remained text, with no image elements created. No console warnings
  or errors were recorded. Native pointer interaction remains a manual check; captured
  pointer movement/cancellation and header-button exclusion are tested at module boundaries.
- Identity scroll QA loaded all 23 and 120 identities without duplicates, selected an
  appended identity, reset search and empty/global time scopes, filled spare space at
  2600px and scrolled at 430px without page-width overflow. Prev/Next identity controls
  are removed. Loaded rows remain in the DOM until reset; virtualization is deferred.
- Tab-wide window QA verified fixed placement directly under body, movement to (8,8)
  beyond graph bounds, 430px containment, reachable Close and parent focus after Escape.
  Upper controls are compacted with existing label sizes and visible focus. Earlier
  graph-stage containment checks are historical; current bounds are the visible tab.
- Visual-polish checks: text ratios 13.31:1 primary / 5.91:1 muted; selected accent
  5.76:1; control outlines 3.41:1 and divider grips 3.15:1. Denied evidence, focus and
  populated 430px reflow were checked. Native copy success feedback appeared, but the
  browser tool's virtual clipboard was empty, so copy readback was not verified here.
  The shared copy handler is unchanged. No console warnings/errors were recorded.

The upstream fixture test skips when its external checkout is absent; it ran here.
Tests required normal Windows path access because the sandbox denies strict resolution
of workspace fixtures. Temporary cases and smoke-test outputs stayed under `.local/`.
Initial small-sample measurements scan the pinned 33 events and project TrailDiscover's
4 events / 3 nodes / 8 links. Five warm module runs: median 12.38 ms, max 12.62 ms.
Five browser runs: HTTP query/decode 16.6–17.4 ms, layout 0–0.2 ms and DOM creation
0.3–0.5 ms. Paint, input latency, peak memory, import costs and representative larger
workloads remain unmeasured; these numbers establish no large-case performance claim.
Current browser diagnostics combine layout and DOM creation as `layoutAndDomMs`;
query/decode and summary updates remain separate. Re-establish separate layout/render
instrumentation before using these diagnostics for broader renderer decisions.
The [latest layout/corpus check record](testing/layout-and-corpus-checks.md) separates
real-log checks from controlled overflow fixtures. Splunk's 4,196-record import took
111.11 seconds; warm event-page queries had a 13.50ms median and identity queries a
247.87ms median while the larger import was active. These are baseline observations,
not isolated performance guarantees. Import batching and projection costs are now
measured priorities rather than reasons to increase budgets.
The validated flaws.cloud 39,207-record member exceeded a 25-minute import budget
and reached about 2.48 GiB peak process working set. That benchmark was stopped,
its unpublished staging directory removed and original bytes preserved. No larger
case graph/browser success is claimed; batch import is needed before repeating it.
The test run emitted one upstream TestClient/HTTPX deprecation warning. HTTPX is a
development dependency; follow the framework's test-client transition in a later
dependency maintenance increment. The build warned about the project-local uv cache;
wheel inspection confirmed it is excluded.

The local preview runs on `http://127.0.0.1:8765`, reading `.local/preview-cases`.
It includes pinned sample/public corpus cases and clearly labeled synthetic/empty/
graph-paging/dense/long-value checks. The current screenshot is `.local/activity-search.jpg`; preview data
and images are ignored.

The earlier hypothetical UI comparison demonstrated design interactions only. Its
middle-dot separators and left-edge accents are superseded by the current visual rules.
The earlier dark surface and all-monospace labels are also superseded: the user's
latest direction requires a professional light theme, reusable UI elements and
accessibility considered in every UI increment.

## Known limitations and open decisions

- Imports are synchronous and create new cases; append/edit, jobs,
  Parquet, oversized-input budgets and interrupted-process recovery are deferred.
- Cases are read-only through the module, not tamper-proof archives. Source copying
  adds disk cost; the larger-corpus import exceeded its recorded budget.
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
- Import is CLI-only. No structured field-query language, saved evidence collection,
  session expansion controls, graph Expand, pan/zoom or Case overview exists yet.
  Dense neighborhoods with many service buckets can still exceed the small prototype
  500-node/1,500-link ceiling after grouping. Dense diagrams still have long scrolling
  lanes and overlapping connection paths; this fix removes the blocking error, not
  the need for better dense navigation and viewport rendering. There is one child window, not a nested hierarchy.
  Positions retained across repeated
  time changes can leave empty lanes; a deliberate new focus resets that history.
- The wrapper distribution/license decision remains open; upstream Suzaku uses AGPLv3.
- `AGENTS.md` is ignored now but remains in earlier commits; ignoring does not erase history.
- Panel and visual-polish work is merged; PRs #13–#16 reached main; activity search awaits review. Import cost blocks practical UI validation of
  the larger corpus until the next performance increment.

## Recommended next increment

Add a safe pivot from a found event to its observed identity and surrounding activity,
including conservative role/session resolution and an explicit ambiguous/unavailable
state. Then add an evidence collection with notes for handoff. Browser import remains
a separate onboarding milestone. Dense navigation, viewport rendering and import
batching remain measured technical needs; do not imply this search is indexed or that
it establishes large-case performance.

## Milestone history

| Date | Step | Outcome |
| --- | --- | --- |
| 2026-10-15 | Compact investigation controls (`fix/graph-workspace-space`) | Collapsible identity/search/connection controls, combined trail heading and remaining-height graph; 69 Python and 40 client tests, targeted browser checks. Depends on PR #17. |
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
| 2026-10-14 | Subgraph window (`feature/subgraph-window`) | Dense fallback, one member window, shared scope/evidence, ordered paging/search and keyboard movement/resize; 61 Python and 14 client tests, browser QA and eight packaged assets. Dependent PR for review. |
| 2026-10-14 | Panel resizing and recurring corpora (`feature/resizable-panels`) | Integrates reviewed #5/#6 branches; responsive dividers, header drag and focusable scroll regions, pinned inert public corpora preparation; 64 Python and 18 client tests, browser QA and ten packaged assets. PR to main. |
| 2026-10-14 | Identity scrolling (`feature/scroll-identities`) | Replaces identity Prev/Next with bounded automatic loading, reset/race/error handling and loaded counts; 64 Python and 22 client tests, browser QA and eleven assets. Dependent on #7. |
| 2026-10-14 | Tab-wide subgraph (`feature/tab-wide-subgraph`) | Body-level fixed window, tab bounds, compact upper controls and 120px identity scroller; 64 Python and 23 client tests, browser QA and eleven assets. Dependent on #8. |
| 2026-10-14 | PR #7 review fixes | Reject duplicate allowlisted members before payload reads; align evidence-divider arrows with pointer movement. 67 Python and 21 client tests; existing pinned corpora still validate. |
| 2026-10-14 | UI integration (`feature/integrate-reviewed-ui`) | Main at `8cca2bb` includes #7; #8/#9 were merged into dependency branches. Integrates their reviewed code unchanged in a PR directly to main. 67 Python and 26 client tests. |
| 2026-10-14 | Integration merged (`5fa5b55`) | PR #10 delivers all reviewed UI changes and review fixes to main. |
| 2026-10-14 | Workbench visual polish (`feature/workbench-polish`) | Neutral first-pass palette, calmer borders/list choices and surface/type hierarchy; unchanged behavior, 67 Python and 26 client tests. For visual review. |
| 2026-10-14 | Time slider (`feature/time-slider`) | Two handles, compact exact fields, commit-on-release shared scope, exact microsecond clamping and clearer identity buttons. PR #11 visual baseline merged; #12 documentation PR closed by owner. |
| 2026-10-15 | Dense grouped graph fix (`fix/dense-grouped-graphs`) | Separates 50/80 detail threshold from 500/1,500 render ceiling; fixes duplicate grouping retry; reproduces and renders 377-event public-log window with all 214 nodes/233 links. Dependent on PR #13. |
| 2026-10-15 | Adjustable graph columns (`feature/graph-columns`) | Full panel width, independent main/child column movement and node widths, captured dragging, keyboard/reset controls, attached links and responsive bounds; dependent on PR #14. |
| 2026-10-15 | Follow trail (`feature/follow-trail`) | Hover/focus/selection prepares an explicit isolated node/link view, direct relationships and unchanged evidence, compact positions, full-view return and scope reset; dependent on PR #15. |
| 2026-10-15 | Reviewed UI merged (`e1f73e5`) | Verified #13–#16 ancestry on main; restored locked environment and seven local cases. |
| 2026-10-15 | Security activity search (`feature/activity-search`) | Security-first product direction, literal event JSON clues and recorded-outcome filters across exact time bounds, with preserved counts/evidence. PR directly to main. |
