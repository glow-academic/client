"""Get the socket ID for an active chat connection from Redis."""

import logging

from app.main import get_redis_client

logger = logging.getLogger(__name__)


async def get_active_connection(chat_id: str) -> str | None:
    """Get the socket ID for an active chat connection from Redis."""
    redis_client = get_redis_client()
    if not redis_client:
        return None

    try:
        connection_sid = await redis_client.get(f"active_connection:{chat_id}")
        return connection_sid.decode("utf-8") if connection_sid else None
    except Exception as e:
        logger.error(f"Redis error getting active connection for chat {chat_id}: {e}")
        return None
