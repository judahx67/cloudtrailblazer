# 0011: Global two-handle time range

2026-10-14. Implemented for review on `feature/time-slider`.

The owner requested compact Start and End fields with a slider between them. Keep
the existing global scope and exact Apply/Reset workflow. Two native range controls
share a track spanning the full case extent. Start's thumb sits above the track;
End's sits below it so both remain reachable at nearly coincident bounds. Native
Arrow/Page/Home/End operation, labels, timestamp value text and full focus outlines
provide keyboard access. On investigation panels below 560px, place the slider below
the fields to preserve usable controls without document overflow.

Input previews update the fields without querying. Native change (pointer release
or keyboard adjustment) applies through the existing scope pipeline, resetting event
paging and refreshing identities, graph, subgraph and evidence membership checks.
Existing latest-request protection discards superseded results. Exact field edits
remain unapplied until Apply. Reset restores the original full bounds.

Use integer microseconds for timestamp conversion and interpolation. Start is included
and End excluded; preserve the summary's last-event-plus-one-microsecond endpoint.
Crossing clamps only the moving bound to one microsecond from the stationary bound.
One-timestamp cases remain usable. Cap the slider at 10,000 approximate steps; exact
fields provide arbitrary microsecond selection. No histogram, density snapping or
whole-window panning is introduced.

Open, invalid, reversed or out-of-case field drafts disable both handles with visible
state, without overwriting the draft or restricting the existing backend query.
Empty cases disable the slider with `No timed events`. A case change disables the
old controls until the new summary is available.

Restore functional outlines and pale gray surfaces on identity/member buttons,
with accent labels; underline event actions. Selection still uses all four borders.
These changes clarify affordances within the accepted neutral enterprise baseline.
