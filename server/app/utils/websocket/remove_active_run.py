"""Remove an active run from Redis."""

import logging

from app.main import get_redis_client

logger = logging.getLogger(__name__)


async def remove_active_run(chat_id: str) -> None:
    """Remove an active run from Redis."""
    redis_client = get_redis_client()
    if not redis_client:
        return

    try:
        await redis_client.delete(f"active_run:{chat_id}")
    except Exception as e:
        logger.error(f"Redis error removing active run for chat {chat_id}: {e}")

