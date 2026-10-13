"""Immutable case imports, event queries and source evidence through one interface."""

import hashlib
import tempfile
from collections.abc import Iterator, Sequence
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4

import duckdb
import simplejson as json

from cloudtrailblazer import __version__
from cloudtrailblazer.readers import ImportFailure, read_events

SCHEMA_VERSION = 1
SCHEMA = """
CREATE TABLE events (
    event_key VARCHAR PRIMARY KEY, event_id VARCHAR, event_time TIMESTAMPTZ NOT NULL,
    event_source VARCHAR NOT NULL, event_name VARCHAR NOT NULL, outcome VARCHAR NOT NULL,
    account_id VARCHAR, actor_arn VARCHAR, source_ip VARCHAR, region VARCHAR,
    raw_json VARCHAR NOT NULL
);
CREATE TABLE occurrences (
    event_key VARCHAR NOT NULL, source_id VARCHAR NOT NULL, ordinal BIGINT NOT NULL,
    PRIMARY KEY (source_id, ordinal)
);
"""


def _canonical(event: dict) -> str:
    return json.dumps(event, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _text(value) -> str | None:
    return value if isinstance(value, str) and value else None


def _timestamp(value: str) -> datetime:
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if result.tzinfo is None:
            raise ValueError("timezone required")
        return result.astimezone(UTC)
    except (ValueError, AttributeError) as exc:
        raise ImportFailure("eventTime must be an ISO timestamp with a timezone") from exc


def _time_filter(start: str | None, end: str | None) -> tuple[str, list]:
    bounds = []
    for field, value in (("start", start), ("end", end)):
        try:
            bounds.append(_timestamp(value) if value is not None else None)
        except ImportFailure as exc:
            raise ImportFailure(f"{field} must be an ISO timestamp with a timezone") from exc
    if all(bounds) and bounds[0] >= bounds[1]:
        raise ValueError("start must precede end")
    sql, values = " WHERE TRUE", []
    for operator, bound in zip((">=", "<"), bounds, strict=True):
        if bound is not None:
            sql += f" AND event_time {operator} ?"
            values.append(bound)
    return sql, values


def _row(event: dict) -> tuple:
    if not isinstance(event, dict):
        raise ImportFailure("CloudTrail record must be an object")
    for field in ("eventTime", "eventName", "eventSource"):
        if not _text(event.get(field)):
            raise ImportFailure(f"CloudTrail record is missing {field}")
    raw = _canonical(event)
    identity = event.get("userIdentity")
    identity = identity if isinstance(identity, dict) else {}
    # Absent errorCode means the log reports no error, not proof of a resource mutation.
    outcome = "failed" if event.get("errorCode") else "no_error_reported"
    return (
        hashlib.sha256(raw.encode("utf-8")).hexdigest(),
        _text(event.get("eventID")),
        _timestamp(event["eventTime"]),
        event["eventSource"],
        event["eventName"],
        outcome,
        _text(identity.get("accountId")),
        _text(identity.get("arn")),
        _text(event.get("sourceIPAddress")),
        _text(event.get("awsRegion")),
        raw,
    )


class CaseStore:
    """Owns case directories. Readers see only complete, schema-compatible cases.

    Imports are synchronous and create new cases; append/edit and concurrent writers
    to a case are intentionally absent. Query pages contain at most 500 events.
    """

    def __init__(self, root: Path):
        self.root = root.resolve()

    def _path(self, case_id: str) -> Path:
        try:
            if str(UUID(case_id)) != case_id:
                raise ValueError
        except ValueError as exc:
            raise ValueError("Invalid case identifier") from exc
        path = self.root / case_id
        if path.is_symlink() or not path.is_dir():
            raise FileNotFoundError(f"Case not found: {case_id}")
        return path

    def inspect(self, case_id: str) -> dict:
        manifest = json.loads((self._path(case_id) / "manifest.json").read_text(encoding="utf-8"))
        if manifest.get("schema_version") != SCHEMA_VERSION:
            raise ValueError("Unsupported case schema version")
        return manifest

    def list_cases(self, *, limit: int = 100, offset: int = 0) -> dict:
        """Discover published cases, reporting unreadable cases without exposing paths."""
        if not 1 <= limit <= 500 or offset < 0:
            raise ValueError("limit must be 1..500 and offset must be nonnegative")
        items, unavailable = [], 0
        for path in self.root.iterdir() if self.root.exists() else []:
            if path.is_symlink() or not path.is_dir():
                continue
            try:
                if str(UUID(path.name)) != path.name:
                    continue
            except ValueError:
                continue
            try:
                manifest = self.inspect(path.name)
                item = {
                    field: manifest[field]
                    for field in ("case_id", "name", "created_at", "event_count")
                }
                if (
                    item["case_id"] != path.name
                    or not isinstance(item["name"], str)
                    or not isinstance(item["created_at"], str)
                    or type(item["event_count"]) is not int
                    or item["event_count"] < 0
                ):
                    raise ValueError("Invalid case metadata")
                items.append(item)
            except (ValueError, OSError, KeyError, TypeError, AttributeError):
                unavailable += 1
        items.sort(key=lambda item: (item["created_at"], item["case_id"]), reverse=True)
        return {
            "total": len(items),
            "unavailable_count": unavailable,
            "items": items[offset : offset + limit],
        }

    def summary(self, case_id: str) -> dict:
        """Case metadata and exact bounds covering every event, including the last."""
        manifest = self.inspect(case_id)
        with duckdb.connect(str(self._path(case_id) / "case.duckdb"), read_only=True) as db:
            db.execute("SET TimeZone = 'UTC'")
            first, last = db.execute(
                "SELECT min(event_time), max(event_time) FROM events"
            ).fetchone()
        return {
            **{
                key: manifest[key]
                for key in (
                    "case_id",
                    "name",
                    "created_at",
                    "event_count",
                    "occurrence_count",
                    "duplicate_count",
                    "conflicting_event_id_count",
                )
            },
            "source_count": len(manifest["sources"]),
            "time_range": {
                "start": first.isoformat() if first else None,
                "end": (last + timedelta(microseconds=1)).isoformat() if last else None,
            },
        }

    def import_case(self, paths: Sequence[Path], *, name: str) -> dict:
        if not paths:
            raise ImportFailure("Provide at least one input file")
        if not name.strip():
            raise ValueError("Case name cannot be empty")
        self.root.mkdir(parents=True, exist_ok=True)
        case_id = str(uuid4())
        # TemporaryDirectory owns only this newly created directory beneath the case root.
        # Malformed inputs never publish a partially imported case.
        with tempfile.TemporaryDirectory(prefix=".import-", dir=self.root) as temp:
            staging = Path(temp) / "case"
            staging.mkdir()
            (staging / "sources").mkdir()
            sources = []
            occurrences = 0
            with duckdb.connect(str(staging / "case.duckdb")) as db:
                db.execute("SET TimeZone = 'UTC'")
                db.execute(SCHEMA)
                db.execute("BEGIN TRANSACTION")
                for source_number, original in enumerate(paths):
                    original = original.resolve(strict=True)
                    if not original.is_file():
                        raise ImportFailure(f"Expected a file: {original}")
                    source_id = f"s{source_number:06d}"
                    snapshot = staging / "sources" / f"{source_id}-{original.name}"
                    digest = hashlib.sha256()
                    byte_count = 0
                    with original.open("rb") as src, snapshot.open("wb") as dst:
                        while chunk := src.read(1024 * 1024):
                            digest.update(chunk)
                            dst.write(chunk)
                            byte_count += len(chunk)
                    count = 0
                    for ordinal, event in enumerate(read_events(snapshot)):
                        try:
                            row = _row(event)
                        except ImportFailure as exc:
                            raise ImportFailure(
                                f"{original.name}, record {ordinal}: {exc}"
                            ) from exc
                        db.execute(
                            "INSERT INTO events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
                            "ON CONFLICT DO NOTHING",
                            row,
                        )
                        db.execute(
                            "INSERT INTO occurrences VALUES (?, ?, ?)", [row[0], source_id, ordinal]
                        )
                        count += 1
                    occurrences += count
                    sources.append(
                        {
                            "source_id": source_id,
                            "original_path": str(original),
                            "snapshot": snapshot.relative_to(staging).as_posix(),
                            "sha256": digest.hexdigest(),
                            "bytes": byte_count,
                            "records": count,
                        }
                    )
                unique = db.execute("SELECT count(*) FROM events").fetchone()[0]
                conflicts = db.execute("""
                    SELECT count(*) FROM (
                        SELECT event_id FROM events WHERE event_id IS NOT NULL
                        GROUP BY event_id HAVING count(*) > 1
                    )
                """).fetchone()[0]
                db.execute("COMMIT")
            manifest = {
                "schema_version": SCHEMA_VERSION,
                "case_id": case_id,
                "name": name.strip(),
                "created_at": datetime.now(UTC).isoformat(),
                "importer_version": __version__,
                "event_count": unique,
                "occurrence_count": occurrences,
                "duplicate_count": occurrences - unique,
                "conflicting_event_id_count": conflicts,
                "sources": sources,
            }
            (staging / "manifest.json").write_text(
                json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
            )
            staging.rename(self.root / case_id)
        return manifest

    def events(
        self,
        case_id: str,
        *,
        limit: int = 100,
        offset: int = 0,
        start: str | None = None,
        end: str | None = None,
    ) -> list[dict]:
        """Time window is [start, end). Results sort by UTC time, then content hash."""
        return self.event_page(case_id, limit=limit, offset=offset, start=start, end=end)["items"]

    def event_page(
        self,
        case_id: str,
        *,
        limit: int = 100,
        offset: int = 0,
        start: str | None = None,
        end: str | None = None,
    ) -> dict:
        """Bounded event summaries and the total matching count for navigation."""
        self.inspect(case_id)
        if not 1 <= limit <= 500 or offset < 0:
            raise ValueError("limit must be 1..500 and offset must be nonnegative")
        where, values = _time_filter(start, end)
        sql = """SELECT event_key, event_id, event_time, event_source, event_name,
                        outcome, account_id, actor_arn, source_ip, region FROM events"""
        sql += where + " ORDER BY event_time, event_key LIMIT ? OFFSET ?"
        with duckdb.connect(str(self._path(case_id) / "case.duckdb"), read_only=True) as db:
            db.execute("SET TimeZone = 'UTC'")
            total = db.execute("SELECT count(*) FROM events" + where, values).fetchone()[0]
            result = db.execute(sql, [*values, limit, offset])
            columns = [column[0] for column in result.description]
            rows = [dict(zip(columns, row, strict=True)) for row in result.fetchall()]
        for row in rows:
            row["event_time"] = row["event_time"].isoformat()
        return {
            "total": total,
            "items": rows,
            "scope": {
                "start": _timestamp(start).isoformat() if start is not None else None,
                "end": _timestamp(end).isoformat() if end is not None else None,
            },
        }

    def iter_events(
        self, case_id: str, *, start: str | None = None, end: str | None = None
    ) -> Iterator[dict]:
        """Scan unique events in deterministic order for local analytical modules.

        The iterator owns a read-only connection until exhausted or closed. Each row
        includes parsed original contents; callers must not accumulate an unbounded scan.
        """
        self.inspect(case_id)
        where, values = _time_filter(start, end)
        sql = (
            "SELECT event_key, event_time, event_id, event_source, event_name, outcome, raw_json "
            "FROM events"
        )
        with duckdb.connect(str(self._path(case_id) / "case.duckdb"), read_only=True) as db:
            db.execute("SET TimeZone = 'UTC'")
            result = db.execute(sql + where + " ORDER BY event_time, event_key", values)
            while batch := result.fetchmany(256):
                for key, time, event_id, service, action, outcome, raw in batch:
                    yield {
                        "event_key": key,
                        "event_time": time.isoformat(),
                        "event_id": event_id,
                        "event_source": service,
                        "event_name": action,
                        "outcome": outcome,
                        "event": json.loads(raw, use_decimal=True),
                    }

    def evidence(self, case_id: str, event_key: str) -> dict:
        manifest = self.inspect(case_id)
        with duckdb.connect(str(self._path(case_id) / "case.duckdb"), read_only=True) as db:
            record = db.execute(
                "SELECT raw_json FROM events WHERE event_key = ?", [event_key]
            ).fetchone()
            if record is None:
                raise KeyError(f"Event not found: {event_key}")
            references = db.execute(
                "SELECT source_id, ordinal FROM occurrences WHERE event_key = ? "
                "ORDER BY source_id, ordinal",
                [event_key],
            ).fetchall()
        sources = {source["source_id"]: source for source in manifest["sources"]}
        return {
            "event_key": event_key,
            "event": json.loads(record[0], use_decimal=True),
            "occurrences": [
                {"source": sources[source_id], "ordinal": ordinal}
                for source_id, ordinal in references
            ],
        }
