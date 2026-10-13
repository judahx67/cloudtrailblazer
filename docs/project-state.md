# Project state

Last updated: 2026-10-13. Latest main checkpoint: `fd88250` (relationship PR #1 merged).
Current increment: `fix/light-workbench`, submitted for PR review against
`feature/events-inspector` (PR #2). This dependent PR contains only the visual/copy
changes; review and merge the inspector prerequisite first, then retarget this PR to main.

## Current milestone

The case/relationship foundation and first local Events inspector are complete. The user
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

There is no rendered graph or Suzaku detection-job integration yet. Python, DuckDB,
FastAPI, Uvicorn and the small JavaScript inspector are implemented choices.
React/Vite and renderer selection remain proposed. See the
[relationship decision](decisions/0002-relationship-projection.md) and
[HTTP/inspector decision](decisions/0003-local-events-inspector.md) for the contracts.

## Validation

Verification on 2026-10-13:

- All 55 Python tests passed: 21 foundation, 19 relationship and 15 HTTP tests.
  Existing evidence/identity semantics and new discovery, pagination, exact full-case
  bounds, decimal text, typed errors, read-only/local policies and assets are checked.
- All 6 client tests passed, including late/canceled results, late network errors,
  actionable HTTP errors, exact microsecond scope membership and page labels.
- Ruff lint and formatting checks passed.
- The light-theme increment also passed JavaScript syntax checking and all existing
  Python/client tests. Browser checks confirmed both copy controls match the full
  displayed JSON exactly, support Enter and disable when evidence clears. Text contrast
  against the main surface: 14.4:1 primary, 6.3:1 muted, 7.1:1 warning. Focus outlines
  remain visible, and controls meet a 24px minimum height. At 430px there was no document
  overflow with populated evidence. No browser console warnings/errors were recorded.
  These are targeted checks, not a full accessibility audit; screen-reader and browser
  zoom verification remain open.
- The wheel built successfully with all four client assets and no local cases,
  environments, caches or upstream checkout included.
- Manual browser verification used all 33 pinned Suzaku AWS events. The denied
  DeleteTrail event opened its AccessDenied JSON and original source/hash/ordinal.
  Empty and invalid ranges, stale evidence, Reset, keyboard selection, exact JSON
  clipboard copying, case switching,
  56-event/25-occurrence synthetic pagination, and unapplied time edits were checked.
  Responsive checks at 920px and 430px had no document-width overflow; the narrow
  event table scrolls horizontally. The browser console showed no errors/warnings.

The upstream fixture test skips when its external checkout is absent; it ran here.
Tests required normal Windows path access because the sandbox denies strict resolution
of workspace fixtures. Temporary cases and smoke-test outputs stayed under `.local/`.
No import/query benchmarks or browser performance measurements have been run.
The test run emitted one upstream TestClient/HTTPX deprecation warning. HTTPX is a
development dependency; follow the framework's test-client transition in a later
dependency maintenance increment. The build warned about the project-local uv cache;
wheel inspection confirmed it is excluded.

The local preview runs on `http://127.0.0.1:8765`, reading `.local/preview-cases`.
It includes the pinned sample case and clearly labeled synthetic/empty checks.
The current screenshot is `.local/light-workbench.jpg`; preview data and images are ignored.

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
- Import is CLI-only. No browser search/action filter, two-handle time slider,
  density grouping, graph expansion/layout or subgraph navigation exists yet.
- The wrapper distribution/license decision remains open; upstream Suzaku uses AGPLv3.
- `AGENTS.md` is ignored now but remains in earlier commits; ignoring does not erase history.
- No new blocker prevents the next increment.

## Recommended next increment

After reviewing this PR, implement the first Identity focus graph slice: searchable
identity selection, a direct neighborhood, and connection selection opening its
supporting events in the shared inspector. Measure projection and rendering separately
before selecting the renderer and refining budgets. Case overview, density groups,
the time slider and the subgraph window follow as focused increments. Detection focus
follows real Suzaku integration.

## Milestone history

| Date | Step | Outcome |
| --- | --- | --- |
| 2026-10-13 | Upstream inspection and project shape | Pinned Suzaku and rules; documented architecture and visual direction. |
| 2026-10-13 | Case foundation (`20cec7a`) | Durable imports, queries, evidence, locked dependencies and 21 passing tests. |
| 2026-10-13 | Agent anchor and reporting | Local anchor and project-state document with milestone reporting requirements. |
| 2026-10-13 | Repository identity | Configured judahx67 and kept AGENTS.md local and ignored. |
| 2026-10-13 | Graph interview (`292b522`) | Consolidated interaction design; subsequently approved by the user and pushed to main. |
| 2026-10-13 | Relationship backend (`4db6da6`, merged `fd88250`) | Identity/session projection, graph/evidence queries, CLI, contract and 40 passing tests. PR #1 merged; branch renamed to feature/relationships. |
| 2026-10-13 | Local Events inspector (`feature/events-inspector`) | Read-only HTTP adapter, packaged terminal-style browser inspector, exact scopes and provenance; 55 Python and 6 client tests, browser QA and wheel verification; PR review. |
| 2026-10-13 | Light workbench (`fix/light-workbench`) | Light-only shared tokens, system sans-serif UI, stronger contrast, reusable code-block Copy control and updated agent/design rules; 55 Python and 6 client tests plus targeted browser QA. Dependent PR awaiting review. |
