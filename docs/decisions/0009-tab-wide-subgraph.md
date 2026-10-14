# 0009: Tab-wide subgraph placement and compact graph controls

2026-10-14. Implemented on `feature/tab-wide-subgraph`, dependent on PR #8.

The graph should remain visible while investigating a member group. Move the single
non-modal subgraph region out of the graph's scrolling container and into the document
body. Fixed viewport positioning lets header dragging and Move Arrow keys cross case,
graph and evidence panels. Keep the entire window inside the visible tab with an 8px
margin; constrain native/keyboard resizing and re-clamp after viewport changes. Open
toward the tab's right edge at graph height. Page/panel scrolling does not move or
clip the window. Back/Close/Escape retain the existing parent focus behavior.

This supersedes the earlier graph-stage placement restriction in decisions 0006/0007.
There is still one window, with shared global time scope and the same evidence path.
It can obscure other panels deliberately while placed over them; users can move it
anywhere else in the tab. It does not become an operating-system window or trap focus.

Compact the app/case/neighborhood headings, view controls, time-form gaps, identity
search and loaded-count spacing. On wider panels, identity search becomes a single
row. Keep a 120px scrollable identity results area, with automatic loading unchanged.
Narrow layouts wrap the search controls. Labels keep existing font sizes; investigation
controls remain at least 30px high with the same focus/contrast tokens.

Validation: 64 Python and 23 client tests, lint/format/syntax, browser and wheel checks.
Browser checks verify a body-level fixed region crossing outside graph bounds,
keyboard movement to the top-left tab margin, 430px viewport containment, reachable
Close and Escape restoring parent focus. Module tests cover captured pointer dragging,
header-button exclusion, tab bounds and shrinking viewport geometry. Native mouse/touch
gestures and the broader accessibility audit remain manual follow-ups.
