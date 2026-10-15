# 0016: Reserve workspace height for the graph

Status: implemented for owner review.

The owner reported that accumulated controls were again crowding the diagram.
The existing graph also had a 390px maximum height regardless of panel space.

Keep case, view and exact time controls visible. Show the identity picker initially,
then collapse it after selection into a named Change disclosure and return focus
there. Keep Find activity on the view row; reveal its form on demand in Identity
focus and keep the form visible in Events. Filters retain their existing scope.

Combine root trail controls with the Neighborhood heading. Put the alternative
connection buttons behind a counted, keyboard-accessible native disclosure with
bounded scrolling. Preserve every graph item and supporting-evidence route.

Let the root graph consume remaining panel height, with a 180px minimum and
scrolling on short panels. Reduce unused spacing above the first diagram row.
Column movement, child window geometry and relationship semantics stay intact.

Native disclosures expose expansion state and keyboard behavior. Opening controls
temporarily uses graph space; the user can close them again. Dense diagrams still
need vertical scrolling and can contain overlapping paths. This layout change does
not establish large-case rendering performance.
