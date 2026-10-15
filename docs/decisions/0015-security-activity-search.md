# 0015: Security-first workflow and activity search

2026-10-15. Product priority selected by the owner; first increment implemented for review.

Prioritize investigation of suspicious AWS activity. Administrative troubleshooting
is a useful secondary workflow using the same evidence tools. The intended path is
an initial clue, relevant events, related activity and a supported investigation
result. Start with a concrete scenario: locate attempts to disable CloudTrail,
inspect the identity and outcome, then determine its surrounding activity.

This increment implements the first search/evidence step. A compact Find activity
form accepts up to 512 characters of literal case-insensitive text across stored
normalized original JSON. Action names, IPs, ARNs, nested resource names, event IDs,
error codes and other recorded text are valid clues. It matches JSON text, including
keys and serialization, rather than parsing a field-query language. Percent and
underscore are literal characters. SQL parameters prevent query interpretation.

Outcome filters are All outcomes, Recorded error and No reported error. The last
means the record has no reported error, not proof of successful effects. Apply the
search and outcome predicates before count and pagination, intersected with existing
inclusive-start/exclusive-end timestamps. Deduplication, raw evidence and source
occurrences do not change. The event-page API adds `search`, `outcome` and a returned
`filters` object; its time-only `scope` contract remains intact.

Search opens Events, starts at page zero and clears previous event selection.
Unsubmitted edits do not change queries or paging. Applied filters remain explicit
as Events only, persist through time/view changes and reset on case changes. Clear
removes both filters. Graph and supporting-event queries use their existing scopes
and never silently inherit the text filter. Reuse the request cancellation, copy,
inspector, style and responsive-layout contracts.

This is an unindexed local JSON scan, not a large-case performance improvement.
The graph is not a detection engine and this increment does not label actions as
attacks. Event-to-identity pivots, evidence collections/notes, browser import and real
Suzaku finding integration remain separate increments. Security and troubleshooting
share precise evidence, while their eventual entry workflows may differ.
