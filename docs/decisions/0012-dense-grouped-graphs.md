# 0012: Separate detail thresholds from render ceilings

2026-10-15. Implemented for review on `fix/dense-grouped-graphs`, dependent on PR #13.

The owner reported a short Splunk public-log window failing with `View limit exceeded
(50 nodes / 80 connections)`. Reproduction for cloudmapper between 2021-04-13T10:33:15
and 17:15:02.000001 UTC contains 377 unique events. Raw output has 241 nodes/329
connections; grouped output has 214 nodes/233 connections. Both satisfy the existing
server output budget, but the client applied its raw-detail threshold to grouped
output and rejected it. A raw projection rejection could also cause two grouped
requests because the second threshold check did not distinguish grouped output.

Keep 50 nodes/80 connections as the automatic grouping trigger for raw views. Use
500 nodes/1,500 connections as the renderer's rejection ceiling, matching the
default server budget. Apply it before modifying position history; do not omit
returned nodes or links. This also permits dense member pages within that ceiling.
Extract one query adapter that requests grouping at most once, preserving typed
errors and existing latest-request cancellation. Label grouped counts explicitly.

No backend budgets, graph semantics, grouping keys or evidence routes change.
The 100,000-event scan ceiling remains independent of output density. This is not
an unlimited graph or a general large-event performance solution. Dense views still
need improved navigation and viewport rendering: existing lanes may be tall and
connection paths may overlap. Keep these limitations distinct from the fixed error.

Validation: a failing regression captured the old rejection, then passed with all
214 nodes/233 links. Browser inspection verifies complete DOM counts, keyboard
access to the last row, group drill-down and original event/source evidence.
One browser run measured 123ms query/decode and 7.4ms combined layout/DOM. Paint,
memory, input latency and maximum-ceiling workloads are not benchmarked.
