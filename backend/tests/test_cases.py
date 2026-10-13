import gzip
import hashlib
from decimal import Decimal
from pathlib import Path

import pytest
import simplejson as json
from cloudtrailblazer.cases import CaseStore
from cloudtrailblazer.cli import main
from cloudtrailblazer.readers import ImportFailure


@pytest.fixture
def event():
    return {
        "eventID": "event-1",
        "eventTime": "2024-08-18T13:05:25Z",
        "eventName": "DeleteTrail",
        "eventSource": "cloudtrail.amazonaws.com",
        "errorCode": "AccessDenied",
        "requestParameters": None,
        "responseElements": None,
        "sourceIPAddress": "109.196.12.142",
        "userIdentity": {"accountId": "123456789012", "arn": "arn:aws:iam::123456789012:user/a"},
    }


def write(path, value):
    path.write_text(json.dumps(value), encoding="utf-8")
    return path


@pytest.mark.parametrize("shape", ["array", "records", "single", "jsonl", "gzip"])
def test_formats_preserve_failed_event_and_source(tmp_path, event, shape):
    value = [event] if shape == "array" else {"Records": [event]} if shape == "records" else event
    path = tmp_path / ("input.jsonl" if shape == "jsonl" else "input.json")
    write(path, value)
    if shape == "gzip":
        compressed = path.with_suffix(".json.gz")
        compressed.write_bytes(gzip.compress(path.read_bytes()))
        path = compressed
    original_bytes = path.read_bytes()
    store = CaseStore(tmp_path / "cases")
    case = store.import_case([path], name="Test")
    assert case["event_count"] == case["occurrence_count"] == 1
    assert case["sources"][0]["sha256"] == hashlib.sha256(original_bytes).hexdigest()
    assert (
        store.root / case["case_id"] / case["sources"][0]["snapshot"]
    ).read_bytes() == original_bytes
    path.unlink()
    rows = store.events(case["case_id"])
    assert rows[0]["outcome"] == "failed"
    assert rows[0]["event_time"] == "2024-08-18T13:05:25+00:00"
    evidence = CaseStore(store.root).evidence(case["case_id"], rows[0]["event_key"])
    assert evidence["event"] == event
    assert evidence["event"]["requestParameters"] is None
    assert evidence["occurrences"][0]["ordinal"] == 0


def test_deduplication_retains_all_occurrences_and_id_conflicts(tmp_path, event):
    duplicate = dict(reversed(list(event.items())))
    conflict = {**event, "eventName": "StopLogging"}
    a = write(tmp_path / "a.json", [event, duplicate, conflict])
    b = write(tmp_path / "b.json", {"Records": [event]})
    store = CaseStore(tmp_path / "cases")
    case = store.import_case([a, b], name="Duplicates")
    assert case["event_count"] == 2
    assert case["occurrence_count"] == 4
    assert case["duplicate_count"] == 2
    assert case["conflicting_event_id_count"] == 1
    row = next(row for row in store.events(case["case_id"]) if row["event_name"] == "DeleteTrail")
    assert len(store.evidence(case["case_id"], row["event_key"])["occurrences"]) == 3


@pytest.mark.parametrize(
    "payload",
    [
        '[{"eventName":"x"}]',
        '{"value": []}',
        '{"Records": null}',
        '{"Records": [42]}',
        '{"Records": [',
        "",
        '{"Records": [], "Records": []}',
        "[] {}",
        '{"Records": []} garbage',
    ],
)
def test_failed_import_is_not_published(tmp_path, event, payload):
    good = write(tmp_path / "good.json", [event])
    bad = tmp_path / "bad.json"
    bad.write_text(payload, encoding="utf-8")
    store = CaseStore(tmp_path / "cases")
    with pytest.raises(ImportFailure):
        store.import_case([good, bad], name="Broken")
    assert list(store.root.iterdir()) == []


def test_empty_inputs_and_records_envelope_after_metadata(tmp_path, event):
    empty = write(tmp_path / "empty.json", [])
    wrapped = write(tmp_path / "wrapped.json", {"metadata": "x", "Records": [event]})
    case = CaseStore(tmp_path / "cases").import_case([empty, wrapped], name="Empty")
    assert case["event_count"] == 1
    assert case["sources"][0]["records"] == 0


def test_jsonl_batches_decimal_precision_and_stable_content_ids(tmp_path, event):
    precise = {**event, "requestParameters": {"number": Decimal("0.123456789012345678901")}}
    source = tmp_path / "events.jsonl"
    source.write_text(
        json.dumps({"Records": [precise]}) + "\n\n" + json.dumps([event]), encoding="utf-8"
    )
    store = CaseStore(tmp_path / "cases")
    case = store.import_case([source], name="Decimals")
    rows = store.events(case["case_id"])
    evidence = [store.evidence(case["case_id"], row["event_key"]) for row in rows]
    found = next(item for item in evidence if item["event"]["requestParameters"])
    assert found["event"]["requestParameters"]["number"] == Decimal("0.123456789012345678901")
    repeat = store.import_case([source], name="Repeat")
    assert [r["event_key"] for r in rows] == [
        r["event_key"] for r in store.events(repeat["case_id"])
    ]


def test_time_filter_pagination_and_missing_evidence(tmp_path, event):
    later = {**event, "eventID": "event-2", "eventTime": "2024-08-18T13:06:25Z"}
    source = write(tmp_path / "events.json", [later, event])
    store = CaseStore(tmp_path / "cases")
    case_id = store.import_case([source], name="Time")["case_id"]
    page = store.events(case_id, limit=1)
    assert page[0]["event_id"] == "event-1"
    assert store.events(case_id, limit=1, offset=1)[0]["event_id"] == "event-2"
    assert (
        store.events(case_id, start="2024-08-18T20:05:25+07:00", end="2024-08-18T13:06:25Z") == page
    )
    with pytest.raises(ValueError):
        store.events(case_id, limit=501)
    with pytest.raises(ValueError):
        store.events(case_id, offset=-1)
    with pytest.raises(ValueError):
        store.events(case_id, start="2024-08-18T13:06:25Z", end="2024-08-18T13:05:25Z")
    with pytest.raises(ImportFailure):
        store.events(case_id, start="2024-08-18T13:05:25")
    with pytest.raises(KeyError):
        store.evidence(case_id, "missing")
    with pytest.raises(ValueError):
        store.inspect("../outside")


def test_case_schema_and_empty_name_validation(tmp_path, event):
    source = write(tmp_path / "events.json", [event])
    store = CaseStore(tmp_path / "cases")
    with pytest.raises(ValueError):
        store.import_case([source], name=" ")
    with pytest.raises(ImportFailure):
        store.import_case([], name="Test")
    case = store.import_case([source], name="Test")
    manifest_path = store.root / case["case_id"] / "manifest.json"
    write(manifest_path, {**case, "schema_version": 999})
    with pytest.raises(ValueError, match="schema"):
        store.events(case["case_id"])


def test_cli_import_inspect_and_errors(tmp_path, event, capsys):
    source = write(tmp_path / "events.json", [event])
    prefix = ["--data-dir", str(tmp_path / "cases")]
    assert main([*prefix, "import", str(source), "--name", "CLI"]) == 0
    case = json.loads(capsys.readouterr().out)
    assert main([*prefix, "inspect", case["case_id"]]) == 0
    assert json.loads(capsys.readouterr().out) == case
    assert main([*prefix, "events", case["case_id"], "--limit", "0"]) == 1
    assert "limit" in capsys.readouterr().err


def test_bundled_aws_fixture_manifest(tmp_path):
    root = Path(__file__).resolve().parents[2]
    manifest = json.loads((root / "fixtures" / "suzaku-aws.json").read_text())
    sources = [root / item["path"] for item in manifest["sources"]]
    if not all(source.is_file() for source in sources):
        pytest.skip("Pinned upstream fixtures are not checked out")
    for item, source in zip(manifest["sources"], sources, strict=True):
        assert hashlib.sha256(source.read_bytes()).hexdigest() == item["sha256"]
    store = CaseStore(tmp_path / "cases")
    case = store.import_case(sources, name="Suzaku AWS")
    assert case["occurrence_count"] == manifest["expected_occurrence_count"]
    assert [source["records"] for source in case["sources"]] == [
        source["records"] for source in manifest["sources"]
    ]
