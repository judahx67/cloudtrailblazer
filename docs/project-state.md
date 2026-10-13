# Project state

Last updated: 2026-10-13. Latest implementation checkpoint: `20cec7a`.

## Current milestone

The local case foundation is complete. Agent guidance and project-manager reporting
expectations are documented in a local, Git-ignored root `AGENTS.md`.
The graph-design interview is complete; [the consolidated design](design/graph-workbench.md)
records the choices and awaits shared-understanding confirmation before implementation.
The remote is `https://github.com/judahx67/cloudtrailblazer.git`, with `judahx67`
selected by repository-local Git credential configuration. No push has been performed.

Implemented capabilities:

- Import explicit AWS CloudTrail JSON/JSONL files and gzip variants into durable cases.
- Preserve source bytes and SHA-256 hashes; retain every source occurrence.
- Deduplicate canonical event contents while keeping conflicting event IDs separate.
- Publish a case only after the full import succeeds; reject unsupported case schemas.
- Inspect cases, query events with pagination and UTC time filtering, and retrieve
  evidence through the case module and development CLI.

The project has no web UI, HTTP interface, relationship graph or Suzaku detection-job
integration yet. Python and DuckDB are implemented choices; React/Vite, FastAPI and
graph-renderer selection remain proposed.

## Validation

Foundation verification on 2026-10-13:

- All 21 tests passed, including format support, duplicate provenance, conflicting
  IDs, failed-import cleanup, timestamp filtering, decimal preservation and evidence retrieval.
- Ruff lint and formatting checks passed.
- The installed CLI imported all 33 events from the pinned AWS fixture set and
  retrieved the denied DeleteTrail event with its source reference and null request parameters.

The upstream fixture test skips when the external checkout is absent. On this Windows
agent environment, tests needed execution outside the sandbox because strict path
resolution was denied for workspace files. Test outputs stayed under `.local/`.
No import/query benchmarks or browser performance measurements have been run.

The current increment records the graph interview and updates design rules; it does
not change application code. Document references, consistency, Git whitespace and the
ignored status of the local anchor are checked. Foundation tests were not rerun.

The earlier hypothetical comparison was checked for session expansion, time handles,
editable bounds, invalid-range errors, evidence selection and responsive widths. It
does not demonstrate a working product graph or production performance. Its older
middle-dot separators and left-edge accents are superseded by the new visual rules.

## Known limitations and open decisions

- Imports are synchronous and create new cases; no case discovery, append/edit or jobs.
- Parquet, oversized-input budgets, interrupted-process recovery and source-hash
  verification commands are deferred.
- Cases are read-only through the module, not tamper-proof archives. Copying sources
  adds disk cost; per-record inserts have not been tuned or benchmarked.
- Interaction choices are captured, including entry modes, session grouping, time
  controls, stable positions and subgraph navigation. Exact identity/session extraction,
  resource mapping and density thresholds still need a tested implementation contract.
- The wrapper's distribution/license decision remains open; upstream Suzaku uses AGPLv3.
- `AGENTS.md` is removed from current tracking but remains in earlier local commits.
  Ignoring a file does not remove its historical contents.
- No new blocker prevents the next design increment.

## Recommended next increment

Confirm the consolidated design captures the shared understanding. Then define and
implement the relationship module with stable identity/session keys, explicit resource
targets, denied outcomes, missing-field behavior and supporting-event references.
Follow with a narrow local HTTP adapter and Events inspector, then graph rendering and
subgraph navigation. First web delivery includes Identity focus and Case overview;
Detection focus follows real Suzaku integration. Renderer selection follows measured workloads.

## Milestone history

| Date | Step | Outcome |
| --- | --- | --- |
| 2026-10-13 | Upstream inspection and project shape | Pinned Suzaku checkout and rules; documented architecture and visual direction. |
| 2026-10-13 | Case foundation (`20cec7a`) | Durable imports, event queries, evidence retrieval, locked dependencies and 21 passing tests. |
| 2026-10-13 | Agent anchor and reporting | Root `AGENTS.md`, current-state document and a required milestone reporting format. |
| 2026-10-13 | Repository identity and local anchor | Configured the judahx67 remote/account preference; kept `AGENTS.md` locally and removed it from tracking. |
| 2026-10-13 | Graph-design interview | Recorded entry modes, expansion, aggregation, time behavior, subgraph navigation and visual rules; consolidated review pending. |
