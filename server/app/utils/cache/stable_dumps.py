"""Stable JSON serialization for cache keys."""

import json
from typing import Any


def stable_dumps(obj: Any) -> str:
    """Stable JSON serialization for cache keys."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))

