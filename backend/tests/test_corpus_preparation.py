import gzip
import hashlib
import importlib.util
import io
import tarfile
from pathlib import Path

import pytest
import simplejson as json

module = importlib.util.spec_from_file_location(
    "corpus_preparation", Path(__file__).resolve().parents[2] / "tools/prepare_test_corpora.py"
)
corpus = importlib.util.module_from_spec(module)
module.loader.exec_module(corpus)


def spec(data):
    return {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "url": "unused"}


def test_existing_corpus_hash_changes_are_rejected_without_network(tmp_path):
    source = tmp_path / "logs"
    source.write_bytes(b"changed")
    with pytest.raises(ValueError, match="hash changed"):
        corpus.acquire(source, spec(b"trusted"), False)
    with pytest.raises(ValueError, match="Missing corpus"):
        corpus.acquire(tmp_path / "missing", spec(b"trusted"), False)


def test_record_shape_and_nesting_are_bounded():
    with pytest.raises(ValueError, match="record shape"):
        corpus.validate([{"eventTime": "2024-01-01T00:00:00Z"}])
    record = {"eventTime": "2024-01-01T00:00:00Z", "eventSource": "test", "eventName": "Read"}
    nested = record
    for _ in range(40):
        nested["nested"] = {}
        nested = nested["nested"]
    with pytest.raises(ValueError, match="Nested"):
        corpus.validate([record])


@pytest.mark.parametrize("duplicate_index", [0, 19])
def test_duplicate_allowlisted_members_are_rejected_before_extraction(
    tmp_path, monkeypatch, duplicate_index
):
    archive = tmp_path / "flaws-cloud" / "flaws_cloudtrail_logs.tar"
    archive.parent.mkdir()
    # Twenty expected files plus one duplicate fit the old 21-entry allowance.
    with tarfile.open(archive, "w") as tar:
        for index in [*range(20), duplicate_index]:
            member = tarfile.TarInfo(f"flaws_cloudtrail_logs/flaws_cloudtrail{index:02d}.json.gz")
            member.size = 1
            tar.addfile(member, io.BytesIO(b"x"))
    monkeypatch.setattr(
        corpus,
        "FLAWS",
        {
            **spec(archive.read_bytes()),
            "member": "flaws_cloudtrail_logs/flaws_cloudtrail19.json.gz",
        },
    )

    def forbidden_extraction(*args, **kwargs):
        pytest.fail("Duplicate members must fail before any member is read")

    monkeypatch.setattr(tarfile.TarFile, "extractfile", forbidden_extraction)
    with pytest.raises(ValueError, match="Unexpected archive"):
        corpus.prepare(tmp_path)
    assert not (archive.parent / "flaws_cloudtrail19.json.gz").exists()


@pytest.mark.parametrize("include_directory", [False, True])
def test_pinned_json_only_archive_and_ndjson_preserve_source_bytes(
    tmp_path, monkeypatch, include_directory
):
    record = {"eventTime": "2024-01-01T00:00:00Z", "eventSource": "test", "eventName": "Read"}
    packed = gzip.compress(json.dumps({"Records": [record]}).encode())
    archive = tmp_path / "flaws-cloud" / "flaws_cloudtrail_logs.tar"
    archive.parent.mkdir()
    with tarfile.open(archive, "w") as tar:
        if include_directory:
            directory = tarfile.TarInfo("flaws_cloudtrail_logs")
            directory.type = tarfile.DIRTYPE
            tar.addfile(directory)
        for index in range(20):
            member = tarfile.TarInfo(f"flaws_cloudtrail_logs/flaws_cloudtrail{index:02d}.json.gz")
            member.size = len(packed)
            tar.addfile(member, io.BytesIO(packed))
    monkeypatch.setattr(
        corpus,
        "FLAWS",
        {
            **spec(archive.read_bytes()),
            "member": "flaws_cloudtrail_logs/flaws_cloudtrail19.json.gz",
            "member_bytes": len(packed),
            "member_sha256": hashlib.sha256(packed).hexdigest(),
        },
    )
    lines = (json.dumps(record) + "\n").encode()
    source = tmp_path / "splunk" / "aws_iam_excessive_list_command_usage.jsonl"
    source.parent.mkdir()
    source.write_bytes(lines)
    monkeypatch.setattr(corpus, "SPLUNK", spec(lines))
    report = corpus.prepare(tmp_path)
    assert report["flaws"]["records"] == report["splunk"]["records"] == 1
    assert source.read_bytes() == lines
    assert (archive.parent / "flaws_cloudtrail19.json.gz").read_bytes() == packed
    # A tar link is never followed, even when it uses an expected log member name.
    with tarfile.open(archive, "w") as tar:
        for index in range(20):
            member = tarfile.TarInfo(f"flaws_cloudtrail_logs/flaws_cloudtrail{index:02d}.json.gz")
            member.type = tarfile.SYMTYPE
            member.linkname = "../../outside"
            tar.addfile(member)
    corpus.FLAWS.update(spec(archive.read_bytes()))
    with pytest.raises(ValueError, match="Unexpected archive"):
        corpus.prepare(tmp_path)
