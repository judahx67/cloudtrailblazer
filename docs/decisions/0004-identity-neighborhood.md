# 0004: First Identity focus neighborhood

Implemented on `feature/identity-graph` for PR review, 2026-10-13.
The later [identity scroll decision](0008-identity-scroll.md) supersedes browser
Prev/Next identity paging; the bounded API remains unchanged.

The merged local inspector establishes a working evidence path. Add a narrow graph
slice over the existing relationship API: identity search/paging, one direct
neighborhood, node details and paged connection evidence. Identity focus is the
default view; Events remains available with the same exact applied UTC bounds.
This is an increment toward the approved graph design, not its full web milestone.

## Renderer and module boundary

Use a small SVG renderer for this slice. Native focusable groups and labeled controls
make pointer and Enter/Space selection straightforward without a new browser library
or build system. The initial Canvas-first proposal is superseded for this bounded
slice; it is not evidence that SVG will fit larger overview workloads. Canvas/WebGL
comparison belongs with representative workloads and interaction measurements.

`graph.mjs` owns view limits, deterministic layout and SVG rendering, consuming the
projection contract without reinterpreting relationships. `identity-workbench.mjs`
owns identity navigation and graph requests. The host receives node/connection
callbacks and owns the shared event table and evidence inspector. `ui.mjs` shares
text-only DOM creation, notices, pagination and detail-list rendering across views.
Untrusted locators/names are rendered with textContent, never HTML interpolation.

Three columns show source IPs, the focused actor and targets. Straight directional
paths and concise S/A references connect to labeled native buttons below the diagram.
Failed attempts have dashed paths and explicit text. An absence of reported errors
does not prove a resource mutation. Service fallback nodes remain labeled `target unspecified`.
Selecting a node exposes its full locator, counts and time range; selecting a link
exposes both endpoints, service-qualified action, outcome and supporting events.
Selection does not expand or change focus. Role grouping follows the existing module;
session expansion is not exposed in this slice.

Positions and link references are retained by stable ID across time changes for the
current case/focus, including IDs that temporarily disappear. A deliberate new focus
or case resets that layout history. Identical display labels never merge nodes.
Self-targets use a visible loop. The graph area scrolls on narrow screens; the document
reflows without requiring horizontal page scrolling. Panning/zooming is not implemented.

The prototype view budget is 50 nodes / 80 connections, separate from the backend's
500 / 1,500 output budget. Above either view budget, clear the diagram and display an
explicit error asking for narrower time. Do not silently truncate, manufacture a
group or leave an old graph visible. This small limit is a provisional legibility
constraint, not a measured scalability limit. Density grouping is the next UI step.

## Scope and evidence

Case event queries validate/canonicalize applied bounds before the identity view
loads. This adds an event-page query; identities and graph then rebuild their scoped
projections independently. Identity search matches name, full locator or account and
uses an explicit Search submission with 20-item pages. Search filters the picker, not
the already selected neighborhood. Changing time refreshes both queries. No activity
for a retained focus is an empty neighborhood, not automatic substitution of another
identity. Draft time edits do not affect any page.

Supporting-event queries include the exact applied bounds and identity ID. Their
50-item pages share the Events row renderer and original evidence inspector. Extend
the case iterator's summaries with stored account/actor/IP/region fields so both paths
have the same summary contract; do not substitute a grouped role for the recorded
session actor. Source occurrences and precise JSON copying remain unchanged.

Case/view/time/focus changes cancel incompatible request channels, clear connection
context and prevent late results replacing newer state. Case/view/focus changes clear
event evidence. Time changes retain selected event evidence with the existing
pending/outside/unverified scope notice; graph details are cleared until reselected.
Shared IPs do not add peer identities to the focused view.

## Verification and measurements

All 56 Python and 10 client tests pass. Coverage includes the focused HTTP evidence
path with another actor sharing an IP, exclusive time bounds, duplicate provenance,
summary parity, unique IDs, separate outcomes, self-targets, explicit view limits and
stable surviving layout. The built wheel includes all seven assets and excludes local
cases, environments and upstream files.

Browser QA covers pinned Suzaku logs, keyboard graph selection, target-unspecified
details, one denied DeleteTrail supporting event and exact JSON copying; search,
exclusive/empty/invalid bounds, retained stale evidence, view/case switching and
synthetic 23-identity / 56-supporting-event pagination. The earlier 56-action fixture
exceeds the view budget and displays an explicit error with an empty diagram.
Synthetic fixtures remain labeled under `.local/`, not performance corpora.

Initial measurements scan the pinned 33-event case for TrailDiscover (4 focused
events, 3 nodes, 8 links). Five warm direct-module projections had median 12.38 ms
and maximum 12.62 ms. Five browser runs measured HTTP query/decode 16.6–17.4 ms,
layout 0–0.2 ms (median 0.1), and DOM creation 0.3–0.5 ms (median 0.4). Browser paint,
input latency, peak memory and larger workloads were not measured. The timings are
development diagnostics in a data attribute, not user-facing controls. These small
samples do not justify large-case performance claims.

Case overview, dense groups, session expansion, Expand, two-handle time controls,
subgraph navigation and Suzaku detection jobs remain separate increments. Full
screen-reader and browser zoom checks also remain open.
