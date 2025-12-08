"""Remove an active chat connection from Redis."""

from app.main import get_redis_client
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


async def remove_active_connection(chat_id: str) -> None:
    """Remove an active chat connection from Redis."""
    redis_client = get_redis_client()
    if not redis_client:
        return

    try:
        await redis_client.delete(f"active_connection:{chat_id}")
    except Exception as e:
        logger.error(f"Redis error removing active connection for chat {chat_id}: {e}")
