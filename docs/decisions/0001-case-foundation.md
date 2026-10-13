# 0001 — Durable cases before graph rendering

Accepted for the first implementation milestone, 2026-10-13.

The graph must be able to simplify relationships while still opening the underlying
evidence. Establish the case module first; it owns import, inspection, bounded event
queries and evidence retrieval. The CLI is a development adapter over that interface.
The eventual HTTP adapter should use the same module.

Use Python 3.12 and DuckDB for local case storage. ijson reads records incrementally;
simplejson preserves decimal JSON numbers without rounding them through binary floats.
Source files are copied before parsing so the indexed record and its hash refer to
the same snapshot even if the user later changes or removes the original.

Case layout:

```text
<case UUID>/
  manifest.json       schema/importer version, counts, source paths and hashes
  case.duckdb         unique events and all source occurrences
  sources/            exact imported file bytes, including compressed inputs
```

The import becomes visible only after all sources parse successfully and the database
is closed. A temporary directory beneath the case root owns the unpublished work.
No append/edit operations exist yet. Case schema version 1 is rejected if unknown;
migrations will be introduced only when a second schema is needed.

An event key is a SHA-256 of canonical JSON contents, scoped by the case in queries.
Canonicalization sorts object keys and removes whitespace, preserves array order and
decimal precision; it does not equate all numerically equivalent representations.
Deduplication is by full content, never by eventID. Each appearance has a source ID and
zero-based event ordinal (not a JSONL line number). The original event is retained;
normalized columns are convenience fields, not a replacement for evidence.

Minimal normalization: UTC time, action, service, actor ARN/account, region, source
address, and reported outcome. Missing errorCode is labeled `no_error_reported`;
it does not establish that the requested mutation occurred. Missing optional fields
remain null. Targets, actor/session resolution and graph grouping remain undecided.

Known limits: per-record inserts prioritize a small, reviewable foundation and have
not been benchmarked. Copying source bytes adds disk cost. A single large record or
JSONL document can still use significant memory; the importer avoids accumulating an
entire event collection. Oversized input budgets, interrupted-process recovery,
read-only archive verification, case discovery, richer filters, jobs, HTTP and UI are
future increments. Temporary folders left by process termination are not valid cases.

Next increment: review the identity/session and explicit-resource relationship model
using these cases, then expose a narrow local HTTP interface and an Events inspector.
Confirm graph semantics before selecting a renderer or broadening the UI.
