"""Get cached response if available."""

from typing import Any

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached


async def get_cached_response(
    request: Any,
    tags: list[str],
    user_ctx: str | None = None,
) -> dict[str, Any] | None:
    """Get cached response if available.

    Args:
        request: FastAPI Request object
        tags: List of cache tags
        user_ctx: Optional user context for per-user caching

    Returns:
        Cached response data or None
    """
    body_dict: dict[str, Any] | None = None
    if request.method == "POST":
        # Request body is already consumed by FastAPI, need to get from parsed model
        # For now, use empty dict - will be handled by route handler
        body_dict = {}

    cache_key_val = cache_key(request.url.path, body_dict, user_ctx)
    return await get_cached(cache_key_val)

