"""Stable JSON serialization for cache keys."""

import json


def stable_dumps(obj: object) -> str:
    """Stable JSON serialization for cache keys."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))
