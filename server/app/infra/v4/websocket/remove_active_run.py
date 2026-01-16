"""Remove an active run from Redis."""

from app.utils.logging.db_logger import get_logger

from app.main import get_redis_client

logger = get_logger(__name__)


async def remove_active_run(chat_id: str) -> None:
    """Remove an active run from Redis."""
    redis_client = get_redis_client()
    if not redis_client:
        return

    try:
        await redis_client.delete(f"active_run:{chat_id}")
    except Exception as e:
        logger.error(f"Redis error removing active run for chat {chat_id}: {e}")
