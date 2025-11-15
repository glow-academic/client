"""Generate stable cache key from path, body, and user context."""

import hashlib
from typing import Any

from app.utils.cache.stable_dumps import stable_dumps

CACHE_KEY_PREFIX = "http:cache:"


def cache_key(
    path: str, body: dict[str, Any] | None = None, user_ctx: str | None = None
) -> str:
    """Generate stable cache key from path, body, and user context."""
    payload = stable_dumps({"p": path, "b": body or {}, "u": user_ctx or ""})
    hash_digest = hashlib.sha1(payload.encode()).hexdigest()
    return f"{CACHE_KEY_PREFIX}{hash_digest}"
