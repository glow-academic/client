"""Get cached HTTP response from Redis."""

import json
import logging
from typing import Any

from app.main import get_redis_client

logger = logging.getLogger(__name__)


async def get_cached(key: str) -> dict[str, Any] | None:
    """Get cached HTTP response from Redis."""
    redis_client = get_redis_client()
    if not redis_client:
        logger.info("Redis client not available, skipping cache read")
        return None

    try:
        raw = await redis_client.get(key)
        if raw:
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8")
            logger.info(f"Cache hit: key={key[:50]}...")
            return json.loads(raw)  # type: ignore
        else:
            logger.info(f"Cache miss: key={key[:50]}...")
    except Exception as e:
        logger.error(f"Error reading cache: {e}", exc_info=True)
    return None
