"""Cache response data."""

from typing import Any

from fastapi import Request

from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.set_cached import set_cached


async def set_cached_response(
    request: Request,
    data: dict[str, Any],
    tags: list[str],
    ttl: int = 60,
    user_ctx: str | None = None,
) -> None:
    """Cache response data.

    Args:
        request: FastAPI Request object
        data: Response data to cache
        tags: List of cache tags
        ttl: Time to live in seconds (default: 60)
        user_ctx: Optional user context for per-user caching
    """
    body_dict: dict[str, Any] | None = None
    if request.method == "POST":
        # Request body is already consumed by FastAPI, need to get from parsed model
        # For now, use empty dict - will be handled by route handler
        body_dict = {}

    cache_key_val = cache_key(request.url.path, body_dict, user_ctx)
    await set_cached(cache_key_val, {"data": data}, ttl, tags)
