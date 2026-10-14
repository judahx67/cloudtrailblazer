# Cloudtrailblazer

A local CloudTrail investigation workbench with case storage and relationship queries.

Agents in the owner's workspace start with the local, Git-ignored `AGENTS.md`.
See [the current project state](docs/project-state.md) for completed milestones,
validation and the next increment. Other checkouts should use this README, the
state document and the accepted decisions; the local anchor is not distributed.

The backend imports AWS logs, preserves evidence and projects relationships. A local
Events inspector opens cases and original evidence. Identity focus renders a direct
observed neighborhood and opens connection-specific event pages in the shared inspector.
Case overview, dense grouping and Suzaku detection jobs are subsequent milestones.

Each coding increment uses a purpose-based branch (`feature/`, `fix/`, `docs/`,
`cicd/`) and a separate pull request for review. Do not use the `codex/` prefix here.
Keep commit messages simple. Merge only after the owner's review and instruction.

## Development

Install Python 3.12+ and uv. From the project root:

```powershell
uv sync --locked
uv run --locked pytest
uv run --locked ruff check .
uv run --locked ruff format --check .
node --test web-tests/*.test.mjs
```

Node.js 22+ is needed for client tests only. The bundled browser client has no build
step; Python runs the application.

## Local web inspector

After importing a case with the CLI:

```powershell
uv run --locked cloudtrailblazer serve
```

Open [the local workbench](http://127.0.0.1:8765). Choose a case, search/select an
identity and inspect its direct neighborhood. Scroll the identity results to load
more automatically; there are no identity page buttons. Select a node for its full details, or
a connection for supporting-event pages; select an event for its original JSON and
source references. Enter/Space select graph items. Use Events for the full case table.
Drag the panel dividers to resize cases, investigation and evidence. Arrow keys and
Home/End resize focused dividers; Reset layout restores defaults. On narrower screens,
panels stack and the dividers adjust height. Scroll regions also accept keyboard focus.
Time inputs accept ISO timestamps
with explicit offsets; Apply updates the range and Reset restores the full case.
Unapplied edits do not affect paging. Evidence outside the applied range is marked.

Cases default to `.local/cases`. `--data-dir <path>` before `serve` selects another
root; `serve --port <port>` changes the port. The CLI binds to loopback only. Stop it
with Ctrl+C. Import remains a CLI operation; the web inspector is read-only.
The SVG neighborhood allows 50 nodes and 80 connections. Dense views automatically
try service/resource and source-IP groups. Select a group, then Open group in the
inspector to browse its members in one in-app window. Search or page 20 members at
a time; member connections use the same supporting-event inspector and applied time
range. Back, Close or Escape return to the parent. Drag the window header or Move,
or use Move's Arrow keys;
resize from the lower-right corner or with the Resize button's Arrow keys.
Grouping preserves unique counts and separates failed attempts from calls with no
reported error. Mixed action names become Activity; inspect its supporting events
for the full actions. Many group buckets/services can still exceed budgets: narrow
time or member search when a visible limit error remains. No links are silently dropped.
Session expansion controls, pan/zoom, the slider and detection UI remain future work.
See the [grouping contract](docs/decisions/0005-grouped-neighborhoods.md) and
[subgraph interaction](docs/decisions/0006-subgraph-window.md).
For recurring larger local tests, see the [corpus guide](docs/testing/cloudtrail-datasets.md).

## Import and query

Use explicit files; the importer does not crawl folders. JSON arrays, CloudTrail
`Records` envelopes, single events, JSONL batches and their `.gz` variants are supported.
Parquet support is deferred. Each successful import creates a new case.

```powershell
uv run --locked cloudtrailblazer import upstream/suzaku/test_files/json/test.json upstream/suzaku/test_files/json/DeleteTrail.json --name "AWS samples"
uv run --locked cloudtrailblazer inspect <case-id>
uv run --locked cloudtrailblazer events <case-id> --limit 25
uv run --locked cloudtrailblazer evidence <case-id> <event-key>
uv run --locked cloudtrailblazer identities <case-id> --search alice
uv run --locked cloudtrailblazer graph <case-id> --identity <identity-id>
uv run --locked cloudtrailblazer graph <case-id> --expand-sessions
uv run --locked cloudtrailblazer connection-events <case-id> <connection-id> --limit 25
```

The commands return JSON. Cases live in `.local/cases`; `--data-dir <path>` before
the subcommand selects another location. Event queries support `--offset`, `--start`
and `--end`. Time bounds require timezone offsets and use an inclusive start and
exclusive end. Event keys come from the event query results.

Relationship queries share those time bounds. Identity IDs come from `identities`;
connection IDs come from `graph`. Pass the same scope options to `connection-events`
to retrieve supporting events in that view, then open their evidence by event key.
Identity lists and connection-event pages support `--limit` and `--offset`.

Recorded role issuers group sessions by default; `--expand-sessions` reveals them.
Unknown targets become service nodes marked `target_unspecified`. Failed attempts
remain separate from calls with no reported error. Queries fail explicitly if scan
or graph budgets are exceeded; narrow the time range or graph identity focus.
These commands return backend data; the web workbench renders Identity focus. See the
[relationship contract](docs/decisions/0002-relationship-projection.md) for resolution
rules, budgets and limitations.

Imported source files are copied byte-for-byte. Event hashes use canonical JSON;
formatting and object key order do not create extra events. All source occurrences
remain available. Conflicting contents with the same CloudTrail event ID stay separate.
Normalized evidence JSON is not a byte-exact rendering; the copied source is.

An invalid input fails the entire import without publishing a case. Cases are
read-only through the module, not tamper-proof archives. Do not manually modify their
files. Snapshot hashes support later verification; there is no verification command yet.

## Upstream

Suzaku is an external, unmodified checkout, ignored by this project's Git configuration.
The fixture manifest pins its revision and source hashes. To obtain the same fixtures:

```powershell
git clone https://github.com/Yamato-Security/suzaku.git upstream/suzaku
git -C upstream/suzaku checkout 306c12a421369dc0aee03ecce521ee09634ee2f6
git -C upstream/suzaku submodule update --init --recursive
```

Fixture tests skip when upstream is absent; the rest of the test suite uses temporary
synthetic records. Dependencies are locked in `uv.lock`. Neither a Suzaku binary nor
its detection rules are executed by this milestone.

See [the project proposal](docs/project-shape.md) and
[the foundation decision](docs/decisions/0001-case-foundation.md).
The approved [consolidated graph design](docs/design/graph-workbench.md) records the
user-facing milestone; its graph interactions are delivered in staged increments.
