"""Cache response data."""

from typing import Any

from fastapi import Request
from redis.asyncio import Redis

from app.utils.cache.cache_key import cache_key
from app.utils.cache.set_cached import set_cached


async def set_cached_response(
    request: Request,
    data: dict[str, Any],
    tags: list[str],
    ttl: int = 60,
    user_ctx: str | None = None,
    *,
    redis: Redis,
) -> None:
    """Cache response data."""
    body_dict: dict[str, Any] | None = None
    if request.method == "POST":
        body_dict = {}

    cache_key_val = cache_key(request.url.path, body_dict, user_ctx)
    await set_cached(cache_key_val, {"data": data}, ttl, tags, redis=redis)
