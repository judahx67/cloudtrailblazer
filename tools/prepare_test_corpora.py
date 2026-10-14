"""Acquire pinned inert CloudTrail logs; never replay attacks or execute corpus files."""

import argparse
import gzip
import hashlib
import io
import tarfile
import time
import urllib.request
from pathlib import Path

import simplejson as json

FLAWS = {
    "url": "https://summitroute.com/downloads/flaws_cloudtrail_logs.tar",
    "bytes": 251688960,
    "sha256": "f26c2b8da56bb00d695a57f00f86208117582b9216bb52424d68e718ca2a96aa",
    "member": "flaws_cloudtrail_logs/flaws_cloudtrail19.json.gz",
    "member_bytes": 4988214,
    "member_sha256": "1bcf77a96388ba206ae0e960403b87e8e0000299dfcfc5e0e2d35906a06f24b2",
}
SPLUNK = {
    "url": "https://media.githubusercontent.com/media/splunk/attack_data/"
    "eac2f8f675ec31a6618003399dcc53641524e673/datasets/attack_techniques/T1580/"
    "aws_iam_excessive_list_command_usage/aws_iam_excessive_list_command_usage.json",
    "bytes": 5038501,
    "sha256": "d0e597bf34919e87ff53d757766a71431847d8788ca80ffe78d8ac23bb498f35",
}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ValueError("Unexpected download redirect")


def acquire(path, spec, download):
    if not path.exists():
        if not download:
            raise ValueError("Missing corpus: use --download for the explicit pinned HTTPS objects")
        path.parent.mkdir(parents=True, exist_ok=True)
        started = time.monotonic()
        temporary = path.with_suffix(".part")
        with urllib.request.build_opener(NoRedirect()).open(spec["url"], timeout=30) as response:
            with temporary.open("wb") as output:
                size = 0
                while chunk := response.read(1024 * 1024):
                    size += len(chunk)
                    if size > spec["bytes"] or time.monotonic() - started > 300:
                        raise ValueError("Download budget exceeded")
                    output.write(chunk)
        verify(temporary, spec["bytes"], spec["sha256"])
        temporary.replace(path)
    verify(path, spec["bytes"], spec["sha256"])


def verify(path, size, digest):
    if path.is_symlink() or path.stat().st_size != size:
        raise ValueError("Unexpected corpus size or symlink")
    with path.open("rb") as stream:
        if hashlib.file_digest(stream, "sha256").hexdigest() != digest:
            raise ValueError("Corpus hash changed: do not automatically update the pin")


def validate(records):
    if not isinstance(records, list) or not 0 < len(records) <= 100000:
        raise ValueError("Unexpected event count or envelope")
    for record in records:
        if not isinstance(record, dict) or not all(
            isinstance(record.get(key), str) for key in ("eventTime", "eventName", "eventSource")
        ):
            raise ValueError("Unexpected CloudTrail record shape")
    pending = [(records, 0)]
    while pending:
        value, depth = pending.pop()
        if depth > 32:
            raise ValueError("Nested data budget exceeded")
        if isinstance(value, (list, dict)):
            children = value.values() if isinstance(value, dict) else value
            pending.extend(
                (child, depth + 1) for child in children if isinstance(child, (dict, list))
            )
    return {
        "records": len(records),
        "services": len({r["eventSource"] for r in records}),
        "actions": len({r["eventName"] for r in records}),
        "utc_start": min(r["eventTime"] for r in records),
        "utc_last": max(r["eventTime"] for r in records),
    }


def prepare(root, download=False):
    root.mkdir(parents=True, exist_ok=True)
    archive = root / "flaws-cloud" / "flaws_cloudtrail_logs.tar"
    acquire(archive, FLAWS, download)
    allowed = {f"flaws_cloudtrail_logs/flaws_cloudtrail{i:02d}.json.gz" for i in range(20)}
    with tarfile.open(archive, "r:") as tar:
        members = tar.getmembers()
        files = [item for item in members if not item.isdir()]
        if (
            len(members) > 21
            or len(files) != len(allowed)
            or len({item.name for item in members}) != len(members)
            or {item.name for item in files} != allowed
            or any(not item.isfile() or item.size > 40 * 1024 * 1024 for item in files)
            or any(item.isdir() and item.name != "flaws_cloudtrail_logs" for item in members)
        ):
            raise ValueError("Unexpected archive members: no extraction performed")
        item = tar.getmember(FLAWS["member"])
        with tar.extractfile(item) as stream:
            packed = stream.read(FLAWS["member_bytes"] + 1)
    if (
        len(packed) != FLAWS["member_bytes"]
        or hashlib.sha256(packed).hexdigest() != FLAWS["member_sha256"]
    ):
        raise ValueError("Member hash/size mismatch")
    with gzip.GzipFile(fileobj=io.BytesIO(packed)) as stream:
        expanded = stream.read(64 * 1024 * 1024 + 1)
    if len(expanded) > 64 * 1024 * 1024:
        raise ValueError("Expanded JSON budget exceeded")
    flaws_stats = validate(json.loads(expanded, use_decimal=True)["Records"])
    member_path = archive.parent / "flaws_cloudtrail19.json.gz"
    member_path.write_bytes(packed)
    splunk = root / "splunk" / "aws_iam_excessive_list_command_usage.jsonl"
    acquire(splunk, SPLUNK, download)
    # Publisher's .json object is NDJSON: rename only, preserve every source byte.
    splunk_stats = validate(
        [
            json.loads(line, use_decimal=True)
            for line in splunk.read_bytes().splitlines()
            if line.strip()
        ]
    )
    report = {
        "flaws": {**FLAWS, **flaws_stats, "expanded_bytes": len(expanded)},
        "splunk": {**SPLUNK, **splunk_stats},
    }
    (root / "validated-manifest.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8"
    )
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true")
    args = parser.parse_args()
    try:
        print(json.dumps(prepare(Path(".local/datasets"), args.download), indent=2))
    except Exception as error:
        # Avoid echoing hostile payload strings in parser exceptions to agents/terminals.
        raise SystemExit(
            f"Corpus preparation failed ({type(error).__name__}); inspect local metadata."
        ) from None
