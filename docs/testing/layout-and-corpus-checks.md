# Layout and corpus verification

2026-10-14. Branch: `feature/resizable-panels`.

The owner merged PRs #4–#6, but the latter two retained their dependency branch
bases. Main contained #4 only. This increment integrates their reviewed code into
its PR to main, then adds panel resizing and recurring corpus preparation.

## Browser behavior

Used the local read-only server with real Splunk CloudTrail records and clearly
labeled synthetic overflow fixtures. Desktop panel widths changed with focused
separator Arrow keys; End retained a 320px investigation pane and exposed horizontal
table scrolling. Reset layout restored defaults. At 920px the evidence divider
changed panel height. At 430px both dividers were horizontal and changed stacked
heights without document-width overflow. The subgraph window remained inside its
stage through responsive changes; Escape returned focus to its surviving parent.

The 4,196-event Splunk case had five resolved identities. Event page 51–100 remained
selectable; PageDown scrolled the 2,489px event table inside its 941px viewport
without changing the page. Selected original JSON copied exactly. The busiest
identity supported 2,694 events and displayed a complete five-node/four-link graph.
One observed browser query/decode took 942ms; layout plus DOM creation took 1.9ms.
These are single browser observations, not latency guarantees or paint measurements.

The breadth fixture has 438 events and 120 long-name identities. A 20-identity page
had 532px of content in a 160px scroll region; PageDown/End moved it and paging showed
21–40 / 120. The busy identity had 200 events and grouped to four nodes/eight links.
Its member diagram had 2,805px of content in a 157px scroll region; keyboard scrolling
worked. A 16,669-character JSON record had horizontal overflow and its embedded HTML
remained plain text: no image elements were created. All synthetic data is labeled,
local and ignored; it is not represented as a real incident.

Native mouse/touch dragging is implemented but unavailable in this browser automation
surface. Module tests drive captured pointer movement, wrong-pointer exclusion,
cancellation, header-button exclusion, clamping and closing during a gesture.
Browser checks use real semantic keyboard controls. Manual pointer gestures,
screen-reader behavior and browser zoom remain required follow-up coverage.
No browser warnings/errors were recorded in the checked flows.

## Corpus measurements

Acquisition pins, licenses, actual record counts and commands are in the
[corpus guide](cloudtrail-datasets.md). No downloaded code or attacks were executed,
no embedded URLs followed, and no records uploaded to analysis services.

The Splunk 4,196-record import took 111.11 seconds. Three warm module event-page
queries had a median of 13.50ms; identity listing had a median of 247.87ms.
A busy-identity raw graph query took 203.44ms and a grouped query took 201.18ms.
Measurements ran while the larger flaws import was active, so they are not isolated
benchmarks. The current importer executes two inserts per occurrence; large imports
need batching work before expanding the corpus size. Relationship queries also
recompute their scoped projection. Peak/native memory, import I/O, paint and input
latency have not been measured. A successful slice does not prove million-event speed.

The flaws.cloud 39,207-record import did not complete within a 25-minute benchmark
budget and was stopped. Its observed peak Windows working set reached 2,659,614,720
bytes (about 2.48 GiB, process/native memory included). The original pinned tar and
gzip member remain intact; only that run's unpublished staging directory was removed.
No partial case was published. Consequently this slice has no large-case graph or
browser result yet. Batch import work is the next prerequisite for that validation;
do not present the prepared corpus as a successfully imported case.

## Checks

- 64 Python tests, including offline corpus hash/shape/nesting/unsafe-link checks.
- 18 client tests, including pointer gestures, separator sizing and responsive modes.
- Ruff lint/format, JavaScript syntax and diff checks.
- Wheel build and byte-for-byte verification of all ten client assets; no raw corpora,
  local cases, caches, environment, tools or agent anchor in the wheel.

The existing TestClient/HTTPX deprecation and project-local uv-cache warning remain.
