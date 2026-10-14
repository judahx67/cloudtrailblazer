# Graph workbench: consolidated design

Date: 2026-10-13. Status: approved by the user for staged implementation.

This describes intended behavior, not delivered capabilities. The current application
has case and relationship modules, a CLI, a local Events inspector and an initial
Identity focus neighborhood. The dependent graph PRs now add density groups and one
member subgraph window with shared time scope and evidence. The conversational
comparison used hypothetical data. Case overview, session expansion controls,
pan/zoom, Expand and the slider remain future work. See the
[subgraph decision](../decisions/0006-subgraph-window.md) for delivered behavior and limits.

## Purpose and audience

Help a security analyst trace identity activity through observed CloudTrail
relationships. Assume basic familiarity with AWS identities, roles and CloudTrail;
explain unfamiliar services and event names through concise hover/focus details.

The graph favors relationships and legibility. Grouping can simplify presentation,
but every connection must lead to supporting events. Shared IPs do not establish a
shared actor, chronology does not establish causation, and a denied call is an attempt.
Automatic attribution of an identity as the origin of a problem is outside this scope.

## Entry points and delivery

Offer three entry points into one investigation workspace:

| Entry point | Starting scope | Delivery |
| --- | --- | --- |
| Identity focus | A selected identity and its observed neighborhood | First web milestone; default |
| Case overview | Grouped relationships across the selected case | First web milestone |
| Detection focus | A real Suzaku finding and surrounding activity | Later, after detection integration |

The identity entry point uses a searchable list with activity count, first/last seen
and account. Counts aid navigation and do not imply suspiciousness. Do not present
synthetic findings as real detections or offer a functioning Detection focus mode
until the underlying integration exists.

## Identities, sessions and targets

- Group role sessions under their IAM role by default, showing the session count and
  an explicit control to reveal sessions. Sessions with an unknown issuer remain separate.
- Stable keys must preserve account and full identity information. Display names and
  session names alone must not merge identities. Exact extraction rules need to be
  specified and tested in the relationship-module increment.
- Start an identity view with its source IPs and directly contacted resources/services.
  Related identities and recorded role transitions are revealed progressively through Expand.
- Use an explicit resource target where the event supports one. When only the service
  is known, connect to a service node and show `target unspecified` in the inspector.
  Do not silently extract targets from error-message prose.
- Example: the bundled denied DeleteTrail event has null request parameters. Show an
  attempted DeleteTrail connection to CloudTrail, not a confirmed modification of a trail.

## Connections and evidence

Aggregate repeated activity by source, target, action and outcome within the selected
scope. Keep different outcomes separate: `GetObject: 120` and `GetObject: 3 denied`.
Preserve event count, first/last seen and references to supporting evidence.

Count unique underlying events, not source duplicates or rule matches. One event can
support several relationships without becoming several events in case totals.
The precise mapping from event fields to each relationship is a separate implementation
contract; a diagram arrow is not evidence of network traversal or causality.

Use thin directional connections. Distinguish denied actions with dashed lines and a
muted warning color, with the outcome also available as text. Reveal action names and
counts on hover or selection; keep resource-group counts visible. Keyboard selection
must reveal the same information as hover.

Clicking a node selects it and opens its details in the shared inspector. Clicking a
connection opens its chronological supporting-event list and raw evidence. Use an
explicit Expand control to add neighbors; selecting an item does not automatically
change the investigation focus or expand the graph.

## Time interaction

Initially use the full imported case time range. Show a two-handle range slider and
editable start/end values, with the timezone visible. Dragging either handle narrows
or widens the selected time span; direct edits provide exact bounds.

The graph, subgraph, counts and supporting-event queries use the same time range and
filters. Keep the case module's inclusive-start, exclusive-end convention. Prevent
crossed handles and reject invalid bounds visibly. Do not silently interpret entered
times in the browser's timezone.

Keep surviving node positions stable as the time range changes. Remove entities with
no matching activity while retaining navigation context for an open subgraph. Exact
updates must not let an older query result replace a newer time selection; responsiveness
and query scheduling will be measured rather than assumed from the mockup.

## Dense groups and subgraph window

When an identity touches many resources, group them by service, with visible counts
that reflect the current time range. For example, `S3: 240 resources`. Do not silently
drop relationships to meet a rendering budget. Let the inspector browse underlying
resources and events.

Opening a resource group reveals a smaller graph workspace inside the web application:

- One movable, resizable subgraph window at a time, inside the graph area.
- Concise title, parent breadcrumb, Back and Close controls.
- The main graph remains in place while the group is investigated.
- Inherit the global time range and filters; do not add independent time controls.
- Node/connection selection uses the existing evidence inspector, which identifies
  the subgraph context of the selected item.
- If still dense, keep grouping and provide search/filtering to reveal manageable detail.
- Opening a deeper group replaces window contents. Back restores the prior view's
  positions and selection; it does not create another window.
- If the range excludes all activity, keep the window and navigation context visible
  with `No activity in this time range`. Clearly mark selected evidence outside the
  current range so it cannot be mistaken for matching activity.

Density thresholds and exact grouping hierarchy remain implementation decisions to
validate on representative workloads. Nested windows are not part of this design.

## Visual rules

Use simple lines, square controls, matte light surfaces, dark text and muted
pastel selection fills. The user requires a professional light theme only. Use system
sans-serif for interface labels and monospace for JSON and technical values. The first
inspector used Consolas throughout; this direction supersedes that font treatment.
Keep labels concise; secondary explanation belongs in hover/focus
details or the inspector. Essential errors, outcome indicators and scope remain visible.

Do not use decorative gradients, rounded card collections, shadows or ornamental
animation. The subgraph window serves a navigation task; it does not introduce a
different decorative style.

Do not spam middle-dot separators. Use `:` for ordinary label/value pairs and `>` for
paths or an intentional terminal-like treatment. Avoid left-edge accent stripes:
when a border highlights an item, highlight all four sides. Apply this to entity-type
accents and selected/active/focus states. Preserve accessible focus indicators.

Reuse shared color and typography tokens, control styles and interaction contracts.
Every code block must have a nearby keyboard-accessible Copy button that copies its
full text without reparsing numbers. Verify text/control contrast, focus visibility,
keyboard operation, target sizes and zoom/reflow in each UI increment. Essential
information must not depend on color or hover alone. Full accessibility conformance
requires a separate audit; browser spot checks are not a substitute.

## First web milestone acceptance criteria

1. Open an imported case and choose Identity focus or Case overview.
2. Find/select an identity; inspect a direct observed neighborhood and grouped sessions.
3. Expand supported relationships deliberately and open grouped resources in a subgraph.
4. Navigate deeper with breadcrumbs and Back while the main graph remains in place.
5. Adjust time through both handles and exact values; synchronize views and evidence
   while preserving surviving node positions and handling an empty window explicitly.
6. Select a connection and retrieve its actual supporting events and original evidence.
7. Preserve failed outcomes, unspecified targets, duplicate provenance and accurate counts.
8. Keep controls keyboard-accessible and follow the agreed visual rules.

This is the complete user-facing milestone, not a requirement to implement every
part in one step. Build reviewable increments: relationship semantics and module
first, then a local HTTP adapter/Events inspector, then the main graph and subgraph.
Detection focus is a later milestone. No performance claims are established by the
hypothetical comparison or the small bundled fixtures.
