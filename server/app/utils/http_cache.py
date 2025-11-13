"""HTTP response caching for FastAPI routes using Redis and tags."""

import hashlib
import json
import logging
from typing import Any, Iterable

from app.extensions import redis_client

logger = logging.getLogger(__name__)

# Cache key prefix
CACHE_KEY_PREFIX = "http:cache:"
TAG_SET_PREFIX = "http:tag:"


def stable_dumps(obj: Any) -> str:
    """Stable JSON serialization for cache keys."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))


def cache_key(path: str, body: dict[str, Any] | None = None, user_ctx: str | None = None) -> str:
    """Generate stable cache key from path, body, and user context."""
    payload = stable_dumps({"p": path, "b": body or {}, "u": user_ctx or ""})
    hash_digest = hashlib.sha1(payload.encode()).hexdigest()
    return f"{CACHE_KEY_PREFIX}{hash_digest}"


def tag_set_name(tag: str) -> str:
    """Get Redis set name for a tag."""
    return f"{TAG_SET_PREFIX}{tag}"


async def get_cached(key: str) -> dict[str, Any] | None:
    """Get cached HTTP response from Redis."""
    if not redis_client:
        return None

    try:
        raw = await redis_client.get(key)
        if raw:
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8")
            return json.loads(raw)  # type: ignore
    except Exception as e:
        logger.error(f"Error reading cache: {e}")
    return None


async def set_cached(
    key: str,
    data: dict[str, Any],
    ttl: int,
    tags: Iterable[str],
) -> None:
    """Store HTTP response in Redis with tag tracking."""
    if not redis_client:
        return

    try:
        pipe = redis_client.pipeline()
        # Store response data
        pipe.setex(key, ttl, json.dumps(data))
        # Track which keys belong to each tag
        for tag in tags:
            pipe.sadd(tag_set_name(tag), key)
            pipe.expire(tag_set_name(tag), ttl)  # Expire tag set with cache
        await pipe.execute()
    except Exception as e:
        logger.error(f"Error writing cache: {e}")


async def invalidate_tags(tags: Iterable[str]) -> None:
    """Invalidate all cache entries for given tags."""
    if not redis_client:
        return

    try:
        pipe = redis_client.pipeline()
        for tag in tags:
            set_name = tag_set_name(tag)
            # Get all keys for this tag
            keys = await redis_client.smembers(set_name)
            if keys:
                # Delete all cached responses
                key_list = [k.decode("utf-8") if isinstance(k, bytes) else k for k in keys]
                pipe.delete(*key_list)
            # Delete tag set
            pipe.delete(set_name)
        await pipe.execute()
        logger.info(f"Invalidated cache for tags: {list(tags)}")
    except Exception as e:
        logger.error(f"Error invalidating cache: {e}")


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


async def set_cached_response(
    request: Any,
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

