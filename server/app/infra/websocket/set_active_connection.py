"""Set the socket ID for an active chat connection in Redis."""

from app.main import get_redis_client
from utils.logging.db_logger import get_logger

logger = get_logger(__name__)


async def set_active_connection(chat_id: str, socket_id: str) -> None:
    """Set the socket ID for an active chat connection in Redis."""
    redis_client = get_redis_client()
    if not redis_client:
        return

    try:
        # Set with expiration (1 hour) to prevent stale data
        await redis_client.setex(f"active_connection:{chat_id}", 3600, socket_id)
    except Exception as e:
        logger.error(f"Redis error setting active connection for chat {chat_id}: {e}")
