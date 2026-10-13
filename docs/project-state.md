# Project state

Last updated: 2026-10-13. Latest main checkpoint: `292b522`.
Relationship implementation: `codex/relationships`, submitted for PR review.

## Current milestone

The case foundation and first relationship backend increment are complete. The user
approved the consolidated [graph design](design/graph-workbench.md). Agent guidance
remains in a local, Git-ignored root `AGENTS.md`. Every coding turn now uses a feature
branch and separate PR; the owner reviews before instructing a merge.

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

There is no web UI, HTTP adapter, rendered graph or Suzaku detection-job integration
yet. Python and DuckDB are implemented choices; React/Vite, FastAPI and renderer
selection remain proposed. See the
[relationship decision](decisions/0002-relationship-projection.md) for the contract.

## Validation

Verification on 2026-10-13:

- All 40 tests passed: 21 foundation tests and 19 relationship tests. Coverage includes
  deduplication/evidence, conflicting IDs, failed imports, decimal preservation,
  role grouping, reused session names, missing/mismatched issuers, uncertain sessions,
  account separation, shared IP focus, explicit targets, half-open time ranges,
  stable IDs, pagination beyond 500 events, empty cases, limits and CLI behavior.
- Ruff lint and formatting checks passed.
- The installed CLI imported all 33 pinned Suzaku AWS events and returned 3 observed
  identities, 9 nodes and 23 connections. The denied DeleteTrail connection opened
  its AccessDenied event and source reference through connection-events and evidence.

The upstream fixture test skips when its external checkout is absent; it ran here.
Tests required normal Windows path access because the sandbox denies strict resolution
of workspace fixtures. Temporary cases and smoke-test outputs stayed under `.local/`.
No import/query benchmarks or browser performance measurements have been run.

The earlier hypothetical UI comparison demonstrated design interactions only. Its
middle-dot separators and left-edge accents are superseded by the current visual rules.

## Known limitations and open decisions

- Imports are synchronous and create new cases; case discovery, append/edit, jobs,
  Parquet, oversized-input budgets and interrupted-process recovery are deferred.
- Cases are read-only through the module, not tamper-proof archives. Source copying
  adds disk cost; per-record inserts have not been benchmarked.
- Each relationship query recomputes its projection. The scan budget bounds event
  count; graph budgets bound output after projection, not peak memory. Identity and
  evidence pagination do not yet avoid the full scoped scan.
- Target extraction supports recorded resource ARNs and STS request roleArn only.
  Missing issuers are not enriched from other records; creation time is a weaker
  session discriminator. No AssumeRole response-to-session causal link is inferred.
- Density grouping, expansion, subgraph navigation, stable layout positions, HTTP
  and keyboard/browser interactions remain future work under the approved design.
- The wrapper distribution/license decision remains open; upstream Suzaku uses AGPLv3.
- `AGENTS.md` is ignored now but remains in earlier commits; ignoring does not erase history.
- No new blocker prevents the next increment.

## Recommended next increment

After reviewing this PR, add a narrow local HTTP adapter and an Events inspector
using the tested module interfaces. Establish loading, empty, stale-evidence and
budget-error states before adding graph rendering. First web delivery uses Identity
focus and Case overview; Detection focus follows real Suzaku integration. Choose the
renderer and refine budgets using measured workloads.

## Milestone history

| Date | Step | Outcome |
| --- | --- | --- |
| 2026-10-13 | Upstream inspection and project shape | Pinned Suzaku and rules; documented architecture and visual direction. |
| 2026-10-13 | Case foundation (`20cec7a`) | Durable imports, queries, evidence, locked dependencies and 21 passing tests. |
| 2026-10-13 | Agent anchor and reporting | Local anchor and project-state document with milestone reporting requirements. |
| 2026-10-13 | Repository identity | Configured judahx67 and kept AGENTS.md local and ignored. |
| 2026-10-13 | Graph interview (`292b522`) | Consolidated interaction design; subsequently approved by the user and pushed to main. |
| 2026-10-13 | Relationship backend (`codex/relationships`) | Identity/session projection, graph/evidence queries, CLI, documented contract and 40 passing tests; PR review. |
