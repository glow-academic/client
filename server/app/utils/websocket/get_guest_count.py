"""Get current guest connection count."""

import logging

from app.main import get_redis_client

logger = logging.getLogger(__name__)


async def get_guest_count() -> int:
    """Get current guest connection count."""
    redis_client = get_redis_client()
    if not redis_client:
        return 0

    try:
        count = await redis_client.get("guest_connection_count")
        return int(count) if count else 0
    except Exception as e:
        logger.error(f"Redis error getting guest count: {e}")
        return 0

