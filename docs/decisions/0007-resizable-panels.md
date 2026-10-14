# 0007: Resize the existing workbench panels

2026-10-14. Implemented on `feature/resizable-panels`.
Window placement is subsequently expanded to the full visible tab in
[decision 0009](0009-tab-wide-subgraph.md).

The task is to give more space to long identity names, large event tables or original
evidence while keeping navigation usable. Keep the existing light workbench and its
information hierarchy. Resize adjacent panels with thin, flat dividers; do not add
new screens or independent floating panels.

Above 1100px, both dividers change side-panel widths and leave at least 320px for
the investigation workspace. At 621–1100px, the case divider changes width and the
evidence divider changes height below the workspace. At 620px and below, all three
panels stack, with height dividers and internal scroll areas. Minimum panel sizes
keep content reachable; exceptionally short viewports can scroll the outer workbench.
Responsive modes retain independent sizes within the current tab. Reset layout
restores defaults. No case data or persistent browser storage is changed.

Dividers are keyboard-focusable separators with orientation, current size and size
limits. Arrow keys adjust by 16px; Home/End use the limits. Pointer dragging captures
one pointer and clamps the affected panel. Changing responsive mode during a gesture
discards further movement until release. Keyboard-focusable case/identity/event and
member-diagram scroll regions permit native keyboard scrolling when content overflows.
Evidence keeps its own scrolling, and original JSON retains horizontal scrolling.

The subgraph window header is now a pointer drag surface; Back and Close remain
ordinary buttons and do not start a drag. Move remains the keyboard alternative.
Closing the window releases captured gestures. Panel and window dragging share one
small pointer helper; graph geometry remains constrained within the graph stage.

The time slider remains deliberately deferred. Exact start/end inputs remain the
applied global scope contract. This increment does not change evidence, graph
aggregation or event precision, and does not introduce pan/zoom or nested windows.

Verification covers pointer movement/capture/cancel and header-button exclusion at
the module boundary, divider minimum space/reset/responsive modes, plus browser
keyboard resizing, independent scrolling, long values, member paging and JSON copy.
Native pointer gestures, screen-reader announcements and browser zoom need manual
validation. Automated geometry checks do not constitute a complete accessibility audit.
