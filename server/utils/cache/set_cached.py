"""Store HTTP response in Redis with tag tracking."""

import json
from collections.abc import Iterable
from typing import Any

from utils.cache.tag_set_name import tag_set_name
from utils.logging.db_logger import get_logger

from app.main import get_redis_client

logger = get_logger(__name__)


async def set_cached(
    key: str,
    data: dict[str, Any],
    ttl: int,
    tags: Iterable[str],
) -> None:
    """Store HTTP response in Redis with tag tracking."""
    redis_client = get_redis_client()
    if not redis_client:
        logger.info("Redis client not available, skipping cache write")
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
        logger.info(
            f"Cache written successfully: key={key[:50]}..., ttl={ttl}, tags={list(tags)}"
        )
    except Exception as e:
        logger.error(f"Error writing cache: {e}", exc_info=True)
