"""Get cached response if available."""

from typing import Any

from fastapi import Request
from redis.asyncio import Redis

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached


async def get_cached_response(
    request: Request,
    tags: list[str],
    user_ctx: str | None = None,
    *,
    redis: Redis,
) -> dict[str, Any] | None:
    """Get cached response if available."""
    body_dict: dict[str, Any] | None = None
    if request.method == "POST":
        body_dict = {}

    cache_key_val = cache_key(request.url.path, body_dict, user_ctx)
    return await get_cached(cache_key_val, redis=redis)
