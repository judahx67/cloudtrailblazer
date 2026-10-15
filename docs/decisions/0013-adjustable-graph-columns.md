# 0013: Adjustable horizontal graph columns

2026-10-15. Implemented for review, dependent on PR #14.

The owner reported unused horizontal space and requested movable/resizable columns
on wider screens. Replace the fixed 630px canvas with the panel's usable width,
keeping 630px as the compact minimum inside a horizontal scroll region. Automatically
spread Source IPs, Identity and Targets across the canvas; increase node widths up
to 260px by default. Existing vertical placement and every relationship stay intact.

Sticky column headers are functional controls. Drag the named header to move a lane;
drag Width to resize its nodes. Left/Right move by 8px, Shift by 40px; Home/End use
the available bounds. Keep columns in semantic order, nodes at least 122px wide,
widths at most 440px and at least 60px between lanes. Target resizing holds its right
edge so it can expand into available space on its left. Connections and self-loops
use current node boundaries; labels reveal more text as widths grow.

Controls remain mounted during SVG redraws, preserving focus and pointer capture.
Column changes do not query the backend or reset selected evidence. Each diagram
has independent tab-local geometry that survives scope/focus changes. ResizeObserver
fits automatic columns or clamps custom positions as the panel changes size. Narrow
screens use internal scrolling; returning to a wide view does not restore geometry
lost through clamping. Reset columns restores automatic sizing for that diagram;
Reset layout resets both. Reload clears these preferences.

Validation covers model constraints, attached endpoints, self-loops, stable vertical
rows, keyboard/captured-pointer controls and reset. Browser checks use the 214-node /
233-link public-log graph, wide/narrow containment, retained selection and child
controls. Native pointer dragging, broader accessibility audit and redraw paint/input
latency remain manual/unmeasured. This does not add graph panning, free node movement,
column reordering, or change grouping, counts and evidence semantics.
