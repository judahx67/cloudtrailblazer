# 0014: Follow an observed node or connection

2026-10-15. Implemented for review, dependent on PR #15.

The owner requested a way to open a view of everything connected to a hovered node
or connection. Add an explicit Follow trail action above each diagram.

Updated 2026-10-15 after owner feedback: only click or Enter/Space selection
prepares the target. Hover and keyboard focus no longer change it, preventing
accidental retargeting while traveling to Follow trail. The button stays disabled
until selection. Clicking Follow activates the selected target and retains its
anchor for details. This applies to main/child diagrams and connection lists.

A node trail retains all incident links and their endpoints. A connection trail
retains exactly that link and its endpoints. Preserve the focused identity as context
for isolated nodes without adding any connection. Use existing stable IDs, outcomes
and supporting-event routes. The selected item's event count is the unique supporting
count; summing link counts would inflate it. Node inspector metadata still describes
the applied neighborhood and is not recomputed from incomplete client evidence.

This is an inline focused view, not a second application window. Main and member
diagrams have independent trails. Keep the original returned graph and position map
for Full neighborhood; focused views use a separate compact map. Column settings
remain available. Return restores all original relationships. A new graph after
time/case/identity/member-page/search changes resets the trail and stale candidates.

This follows observed relationships only within the returned neighborhood or member
page. It is not causal attribution, a multi-hop traversal across the case, or the
planned backend Expand operation. Group membership and full event evidence remain
available through their existing controls. No network query is needed to isolate
the diagram; selecting a connection uses the ordinary evidence query.

Tests cover complete incident links, separate outcomes, stable IDs, self-loops,
non-summed counts, reset/return and selection without activation, plus renderer interaction regression
coverage for hover/focus stability and click/Enter/Space activation. Browser checks cover
connection evidence, node isolation, full return, scope reset and 430px containment.
Native hover and broader screen-reader/zoom audits remain manual.
