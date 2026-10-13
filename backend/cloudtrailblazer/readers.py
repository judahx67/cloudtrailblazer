"""Read CloudTrail records incrementally; never interpret unrelated JSON as empty logs."""

import gzip
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import ijson


class ImportFailure(ValueError):
    """An input cannot be imported as a CloudTrail case."""


def _value(tokens: Iterator, token: tuple[str, Any]) -> Any:
    kind, value = token
    if kind == "start_map":
        result = {}
        for kind, key in tokens:
            if kind == "end_map":
                return result
            if kind != "map_key" or key in result:
                raise ImportFailure("Invalid or duplicate JSON object key")
            result[key] = _value(tokens, next(tokens))
    elif kind == "start_array":
        result = []
        for token in tokens:
            if token[0] == "end_array":
                return result
            result.append(_value(tokens, token))
    elif kind in {"string", "number", "boolean", "null"}:
        return value
    raise ImportFailure("Incomplete or invalid JSON value")


def _array(tokens: Iterator) -> Iterator[dict]:
    for token in tokens:
        if token[0] == "end_array":
            return
        yield _value(tokens, token)
    raise ImportFailure("Incomplete record array")


def _document(tokens: Iterator, token: tuple[str, Any]) -> Iterator[dict]:
    if token[0] == "start_array":
        yield from _array(tokens)
        return
    if token[0] != "start_map":
        raise ImportFailure("Expected an event, event array, or Records object")
    fields = {}
    keys = set()
    wrapped = False
    for kind, key in tokens:
        if kind == "end_map":
            if not wrapped:
                yield fields
            return
        if kind != "map_key" or key in keys:
            raise ImportFailure("Invalid or duplicate JSON object key")
        keys.add(key)
        token = next(tokens)
        if key == "Records":
            wrapped = True
            if token[0] != "start_array":
                raise ImportFailure("Records must be an array")
            yield from _array(tokens)
        else:
            fields[key] = _value(tokens, token)
    raise ImportFailure("Incomplete event object")


def read_events(path: Path) -> Iterator[dict]:
    """JSON arrays, Records envelopes, single events and JSONL; optional gzip.

    Source ordinals are assigned by the caller and count events, not text lines.
    Decimal numbers retain their value. Each event is materialized independently.
    """
    logical_name = path.name.removesuffix(".gz")
    if not logical_name.endswith((".json", ".jsonl")):
        raise ImportFailure(f"Unsupported input: {path.name}")
    opener = gzip.open if path.name.endswith(".gz") else open
    try:
        with opener(path, "rb") as stream:
            tokens = iter(
                ijson.basic_parse(stream, multiple_values=logical_name.endswith(".jsonl"))
            )
            seen_document = False
            for token in tokens:
                seen_document = True
                yield from _document(tokens, token)
            if not seen_document and not logical_name.endswith(".jsonl"):
                raise ImportFailure("Empty JSON document; use [] for an empty log")
    except (ijson.JSONError, EOFError, StopIteration, RuntimeError) as exc:
        raise ImportFailure(f"Invalid JSON in {path.name}: {exc}") from exc
