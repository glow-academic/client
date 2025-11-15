"""Get the active run ID for a chat from Redis."""

import logging

from app.main import get_redis_client

logger = logging.getLogger(__name__)


async def get_active_run(chat_id: str) -> str | None:
    """Get the active run ID for a chat from Redis."""
    redis_client = get_redis_client()
    if not redis_client:
        return None

    try:
        run_id = await redis_client.get(f"active_run:{chat_id}")
        return run_id.decode("utf-8") if run_id else None
    except Exception as e:
        logger.error(f"Redis error getting active run for chat {chat_id}: {e}")
        return None
