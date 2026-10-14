# 0006: One subgraph window inside Identity focus

2026-10-14. Implemented on `feature/subgraph-window`, reviewed in PR #6.
The owner merged the dependent branches; `feature/resizable-panels` carries those
reviewed changes into main. Header dragging and panel dividers are described in
[the resize decision](0007-resizable-panels.md).

The task is to inspect a dense group's members without losing the parent identity,
global time range or path back to original evidence. Keep the existing light workbench
and shared graph, control, request and inspector helpers. No new UI dependency is needed.

Raw neighborhoods remain the first view. Above the 50-node / 80-link browser budget,
or an HTTP 413 projection-limit response, retry the grouped endpoint. Other errors
remain errors. Grouped output still has explicit budgets; no returned links are omitted.
Selecting a group shows details and an explicit Open group button. This opens or
replaces the single non-modal window within the graph stage, with a parent breadcrumb,
Back/Close, member search, count, 20-member pager and child graph. Search and paging
reset child layout history; surviving positions remain stable through time changes.
The full group count and the visible member page count remain distinct.

The member API adds ordered `member_ids` and refreshed full `group` metadata. This
keeps counts current and represents self-target members even when their ID is also
the focused identity. Child graphs and their links contain only the visible members'
observed group activity. The common inspector identifies the subgraph context.
Grouped supporting-event requests carry their parent group ID. Failed attempts,
distinct action counts and original link counts remain visible; raw evidence retains
the detail omitted from the diagram. Source-IP grouping establishes no shared identity.

There is no independent child time range. Applying global bounds clears pending child
content, cancels/discards stale requests, refreshes both views and starts member paging
at zero. A group absent in that range gets an explicit unavailable state. Invalid
scope queries keep an explicit scope-unavailable state. Original selected evidence may
remain with the existing stale/out-of-scope label. Changing case, focus or investigation
view closes the window. Back/Close/Escape return keyboard focus to a surviving parent
group, or the identity search when that group no longer exists.

Move supports pointer dragging and Arrow keys. Native corner resizing has an Arrow-key
alternative on Resize. Geometry is constrained within the stage, including viewport
changes. Controls use existing focus/contrast tokens; the window has four-border
selection and concise labels with secondary instructions in titles. The window does
not trap focus. Two simultaneous diagrams use different SVG marker IDs.

Validation includes 61 Python and 14 client tests, browser member paging/search,
child evidence and exact copying, source groups, empty/invalid/reset scopes, keyboard
move/resize/close and responsive containment. Pointer dragging/corner resizing,
screen readers and browser zoom still need manual coverage. This slice does not add
nested windows, session expansion controls, explicit graph Expand, a case overview,
pan/zoom or the time slider. Representative large-case performance remains unmeasured.
