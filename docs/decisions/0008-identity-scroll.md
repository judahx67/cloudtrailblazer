# 0008: Scroll to browse identities

2026-10-14. Implemented on `feature/scroll-identities`, dependent on PR #7.

Identity results should form one scrollable list, without Prev/Next navigation.
Keep the existing bounded identity API: load 20 results at a time and append the
next page when scrolling approaches the bottom. Fill spare space automatically on
wide grids or resizing. Show loaded/total counts and loading state concisely; preserve
already-loaded rows, current focus/selection and the graph while appending.

One request may run at a time. Search, applied time, case or view changes cancel/reset
the loader and discard stale successes and failures. A new list starts at scroll top.
Empty results stop loading. Errors preserve loaded rows and their next offset;
scroll up/down retries, rather than introducing another navigation button or a retry
loop. An inconsistent empty page fails explicitly. Keyboard scrolling and focusing
off-screen identity controls follow the same native scroll behavior.

The UI keeps fetched rows in the DOM until reset; it does not fetch every identity
up front. Very large identity populations will need virtualization, and the backend
still recomputes its scoped projection for each page. This increment establishes no
large-case performance claim. Event/source/member pagination remains unchanged.

Validation: loader tests cover serialization, append/end, late success/failure after
reset, retained results/retry offset and empty/inconsistent pages. Browser checks
load all 23 and all 120 identities through keyboard scrolling, select appended rows,
reset search/time scopes, fill a 2600px-wide viewport and scroll at 430px without
page-width overflow. Screen-reader behavior remains part of the pending accessibility
audit. All 64 Python and 22 client tests pass; all eleven assets ship in the wheel.
