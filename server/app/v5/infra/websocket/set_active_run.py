"""Set the active run ID for a chat in Redis."""

from app.v5.infra.globals import get_redis_client
from app.v5.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


async def set_active_run(chat_id: str, run_id: str) -> None:
    """Set the active run ID for a chat in Redis."""
    redis_client = get_redis_client()
    if not redis_client:
        return

    try:
        # Set with expiration (2 hours) to prevent stale data
        await redis_client.setex(f"active_run:{chat_id}", 7200, run_id)
    except Exception as e:
        logger.error(f"Redis error setting active run for chat {chat_id}: {e}")
