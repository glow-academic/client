"""Get cached HTTP response from Redis."""

import json
import logging
from typing import Any

from app.main import redis_client

logger = logging.getLogger(__name__)


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
