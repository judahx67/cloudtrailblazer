# Cloudtrailblazer: initial project shape

Status: architecture proposal with the case foundation implemented on 2026-10-13.
See [decision 0001](decisions/0001-case-foundation.md) for the accepted scope and limits.
The web UI, relationships and Suzaku job integration are not implemented.
See [the consolidated graph design](design/graph-workbench.md) for interview choices
and its review status; it supersedes the early interaction proposals below.

## Direction

Build a local-first web workbench for AWS CloudTrail investigations. Keep Suzaku as the detection engine, invoked through its CLI. Build relationship extraction and graph projection in the wrapper. Start with AWS; defer Azure and Google Workspace until the CloudTrail interaction model works.

The graph is a simplified navigation view of observed activity. It may omit details and group repetitive activity, but must preserve the meaning of a relationship. Every displayed connection opens its supporting events. A failed call remains an attempt; shared IP addresses do not imply shared identity; chronology alone does not establish causation.

## Inspection evidence

- Checkout: `upstream/suzaku`, commit `306c12a421369dc0aee03ecce521ee09634ee2f6`, package 2.0.1. Rules submodule: `0f76243c1fe593458939d5cd174fd8ef7660d2d8`.
- Rust executable, with internal modules rather than a public library interface (`src/main.rs`, `Cargo.toml`). The declared Rust minimum is 1.97.1.
- CLI supports CSV, JSON, JSONL and DuckDB output (`src/option/cli.rs`). Raw JSON output can be enriched with rule metadata (`src/core/timeline_writer.rs`).
- DuckDB output has schema version 1, typed timestamps, severity, lists and provenance (`src/core/duckdb_out.rs`). Output profile selection still matters; consumers must inspect the actual schema.
- Timeline rows represent event × rule matches; EventID is not unique. Correlation rows combine member values and use the latest member timestamp. Do not treat correlation rows as single raw events.
- Bundled AWS JSON fixtures contain 33 events across six files, including an empty `PutEventSelectors.json`; `test.json` contains 29 events. Azure, Google Workspace and Parquet fixtures also exist. This is a functional fixture set, not a realistic performance corpus.
- `DeleteTrail.json` has AccessDenied and null request parameters. Its error text mentions a trail, but that does not justify silently synthesizing an explicit request target.
- Upstream license is AGPLv3 (`LICENSE.txt`). Record this dependency and choose the wrapper's distribution/license deliberately before publication.

## Proposed implementation

Python and DuckDB are implemented for the case foundation. A TypeScript web client (React + Vite) and FastAPI HTTP adapter remain candidate choices. Python supports the initial local processing and future subprocess integration; we can revise packaging after measuring import and query costs.

The local process owns imports, decompression, indexing, Suzaku jobs, and graph projection. The browser receives bounded graph results and paginated event rows. No cloud credentials or hosted upload are needed for the first experiment. Run the process on loopback; keep case files on disk and use argument arrays for CLI execution.

Suggested layout:

```text
apps/web/              investigation UI
backend/               case import, Suzaku jobs, queries and graph projection
docs/                  decisions and interaction specification
fixtures/              fixture manifest and reproducible larger corpus generator
upstream/suzaku/        inspected upstream checkout, kept unchanged
```

The wrapper currently ignores the separate upstream checkout and pins fixture revisions and hashes in its fixture manifest. Choose binary distribution or a pinned submodule when implementing detection jobs. Record the engine and rules revisions with each detection run; the current importer does not execute Suzaku.

## Modules and their interfaces

1. Case module: import paths, inspect case status, query events, and retrieve original evidence. Internally stream inputs, normalize records, deduplicate exact records, and record source file/index and content hashes. Preserve conflicting records with the same eventID rather than merging them silently.
2. Detection module: start/cancel a Suzaku job and retrieve findings. Keep subprocess arguments, output profiles, revision checks, progress and failures inside this module. Prefer JSONL for the first integration and evaluate upstream DuckDB output for richer querying. Validate artifacts as well as process completion.
3. Relationship module: query a graph for a case, time range, filters and focus entity; retrieve supporting events for a connection. Hide extraction, grouping, node limits and layout inputs behind this small interface.

Store raw events and findings separately. Join ordinary findings through case-scoped event identifiers where available; retain source provenance and unmatched findings. Preserve multiple rules per event without inflating activity counts. Keep correlation findings separate unless their exact supporting-event mapping is available.

## Graph model

Nodes initially represent identities, role sessions, IP addresses, explicit resources and services. Use account-scoped identity keys and full ARNs as stable identifiers. Session names and display labels are not identity keys. Retain session issuer separately from the acting session.

Connections describe observed activity: IP → acting identity/session (observed source), actor → explicit resource (action), actor → service (when no explicit target is available), and explicit STS role assumption links where supported by the event. Multiple resource targets can produce multiple connections but still represent one event.

Aggregate by source, target, action and outcome within the selected time range. Store event count, first/last seen and evidence references. Finding counts and severity can be added after detection integration. Keep distinct outcomes available; never turn a denied action into a successful modification.

Default entry: Identity focus, with Case overview also available in the first web milestone. Detection focus follows later. Clicking selects; explicit Expand adds context. Dense resource sets group by service and open in one movable, resizable subgraph window. Filters and time apply before grouping. Suppress repetitive edges visually by grouping, not by discarding underlying events. Do not create an individual node for every API call.

Start with a Canvas renderer and deterministic layout, evaluated against a WebGL renderer on the same graph payload. Choose the renderer from measured interaction performance. Keep layout off the main UI thread where needed, stop it once settled, and preserve positions during selection/filtering where possible.

## Interaction and visual contract

- Fixed structure: narrow filter rail, large graph/table workspace, evidence inspector on the right, compact status line below. Graph and Events views share selection and filters.
- Matte charcoal background, off-white text, muted pastel accents. One-pixel dividers, square controls, monospace labels, no gradients, shadows or decorative animation.
- Use `:` or `>` instead of repeated middle-dot separators. Highlight all four borders, not a left-edge accent stripe.
- Color communicates entity type; severity uses a small distinct marker and text. Selection uses an outline so it remains recognizable without color.
- Compact labels: `Open`, `Graph`, `Events`, `Time`, `Findings`, `Expand`. Use counts rather than explanatory paragraphs. Long identifiers truncate visually but can be inspected and copied in full.
- Hover/focus reveals a short tooltip. Selected evidence stays in the inspector. Essential state, errors, grouping counts and failed outcomes remain visible without hover.
- Two time handles and editable bounds filter the main graph, subgraph and evidence together. Preserve surviving node positions. The subgraph uses the shared inspector and breadcrumbs/Back for deeper navigation.
- Keyboard focus and explicit expand/select controls mirror pointer interactions. Disable motion by default; panning and zooming respond directly to input.
- No dashboard cards or ornamental statistics. Each visible control must support import, scope, navigation or evidence inspection.

## First runnable slice

Import the bundled AWS fixtures; show IP → actor → service/explicit resource relationships; filter by time; select an edge to show its event rows and raw JSON; then overlay Suzaku findings. Include the denied DeleteTrail case and the empty file in acceptance checks.

Before broad feature work, benchmark 10k, 100k and 1m reproducibly generated events plus a realistic corpus when available. Report import/index time, peak process memory, graph projection latency, first render time and pan/select responsiveness separately. Generated data must include varied identities/resources and skewed high-degree actors, not just repeated copies of one event. The bundled fixtures cannot substantiate performance claims.

Provisional budgets to validate: graph query p95 under 500 ms after indexing; first render under 1 s for a returned view of 500 nodes/1,500 edges; pan/select near 60 fps on the test machine. These are targets, not measurements. If the overview exceeds the view budget, return groups and explicit hidden counts rather than silently truncating relationships.

## Decisions to make after the slice

Compare browser interaction and local processing costs before considering a desktop shell. Decide whether timelines, saved investigation views or STS/session traversal is the next extension using the actual sample workflow. Keep detection-engine modifications separate until a concrete missing capability requires an upstream change.
