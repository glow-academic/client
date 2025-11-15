"""Store HTTP response in Redis with tag tracking."""

import json
import logging
from typing import Any, Iterable

from app.main import redis_client
from app.utils.cache.tag_set_name import tag_set_name

logger = logging.getLogger(__name__)


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

