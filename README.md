# Cloudtrailblazer

A local CloudTrail investigation workbench, beginning with the case module.

Agents in the owner's workspace start with the local, Git-ignored `AGENTS.md`.
See [the current project state](docs/project-state.md) for completed milestones,
validation and the next increment. Other checkouts should use this README, the
state document and the accepted decisions; the local anchor is not distributed.

The first milestone imports AWS logs, preserves evidence and queries events. Graphs,
the web interface and Suzaku detection jobs are subsequent milestones.

## Development

Install Python 3.12+ and uv. From the project root:

```powershell
uv sync --locked
uv run --locked pytest
uv run --locked ruff check .
uv run --locked ruff format --check .
```

Use explicit files; the importer does not crawl folders. JSON arrays, CloudTrail
`Records` envelopes, single events, JSONL batches and their `.gz` variants are supported.
Parquet support is deferred. Each successful import creates a new case.

```powershell
uv run --locked cloudtrailblazer import upstream/suzaku/test_files/json/test.json upstream/suzaku/test_files/json/DeleteTrail.json --name "AWS samples"
uv run --locked cloudtrailblazer inspect <case-id>
uv run --locked cloudtrailblazer events <case-id> --limit 25
uv run --locked cloudtrailblazer evidence <case-id> <event-key>
```

The commands return JSON. Cases live in `.local/cases`; `--data-dir <path>` before
the subcommand selects another location. Event queries support `--offset`, `--start`
and `--end`. Time bounds require timezone offsets and use an inclusive start and
exclusive end. Event keys come from the event query results.

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
