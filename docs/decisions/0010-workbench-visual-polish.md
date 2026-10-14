# 0010: Quieter workbench presentation

2026-10-14. First pass implemented on `feature/workbench-polish` for visual review.

The owner described the current UI as too flat, edgy and expressive for an enterprise
workbench. The inspected screen gives nearly every item the same outline, creating a
wireframe hierarchy. Refine that existing screen rather than add decorative panels
or change its investigation workflow. Neutral white/gray with restrained blue selection
is the stated first-pass assumption; the owner may still choose the muted-green variant.

Separate decorative section lines from functional control boundaries. White workspace
and evidence surfaces sit beside a pale gray case rail and app header. Inactive case,
identity and view choices no longer each have a box; selected items retain a complete
four-border outline and a pale fill. Inputs, buttons, graph nodes and divider grips
retain stronger boundaries. Dividers use a small centered grip instead of dark lines
down the full screen. Table headings gain weight, and event actions remain semantic
buttons with a quieter visual treatment. The app name gains modest type hierarchy.

Keep the light theme, square controls, compact layout, system sans-serif, technical
monospace, concise labels and existing focus indicators. No gradients, shadows,
rounded card collections, animation, new dependency, API or interaction change.
Selected hover states preserve the selected outline/fill. The movable window has a
neutral frame and emphasizes its complete border when focus enters it.

Palette checks: primary text on white 13.31:1; muted 5.91:1; accent on selected fill
5.76:1; control boundary on white 3.41:1; divider grip on gray 3.15:1; warning on white
7.39:1. Structural separators are decorative, not the only identifier of a control.
These are targeted checks, not a complete accessibility conformance claim.

Validation includes 67 Python/26 client tests, lint/format/diff and eleven-asset wheel
verification. Browser checks cover identity selection, denied-event evidence, focus,
dividers and populated 430px reflow. Copy success feedback was observed, but the current
browser tool's virtual clipboard returned empty and could not verify native clipboard
readback; the shared copy handler is unchanged. Native gestures and the broader
screen-reader/zoom audit remain open. Import performance work remains the next
engineering milestone after this visual review.
