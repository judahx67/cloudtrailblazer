"""Small development entry point for the case module."""

import argparse
import sys
from pathlib import Path

import duckdb
import simplejson as json

from cloudtrailblazer.cases import CaseStore


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="cloudtrailblazer")
    parser.add_argument("--data-dir", type=Path, default=Path(".local/cases"))
    commands = parser.add_subparsers(dest="command", required=True)
    importer = commands.add_parser("import")
    importer.add_argument("paths", type=Path, nargs="+")
    importer.add_argument("--name", required=True)
    inspector = commands.add_parser("inspect")
    inspector.add_argument("case_id")
    events = commands.add_parser("events")
    events.add_argument("case_id")
    events.add_argument("--limit", type=int, default=100)
    events.add_argument("--offset", type=int, default=0)
    events.add_argument("--start")
    events.add_argument("--end")
    evidence = commands.add_parser("evidence")
    evidence.add_argument("case_id")
    evidence.add_argument("event_key")
    args = parser.parse_args(argv)
    store = CaseStore(args.data_dir)
    try:
        if args.command == "import":
            result = store.import_case(args.paths, name=args.name)
        elif args.command == "inspect":
            result = store.inspect(args.case_id)
        elif args.command == "events":
            result = store.events(
                args.case_id, limit=args.limit, offset=args.offset, start=args.start, end=args.end
            )
        else:
            result = store.evidence(args.case_id, args.event_key)
    except (ValueError, OSError, KeyError, duckdb.Error) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 0
