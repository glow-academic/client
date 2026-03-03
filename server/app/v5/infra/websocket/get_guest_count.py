"""Get current guest connection count."""

from app.main import get_redis_client
from app.v5.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


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
