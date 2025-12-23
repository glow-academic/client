"""Set the socket ID that owns a profile in Redis."""

from app.main import get_redis_client, get_socket_owner_dict
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


async def set_socket_owner(profile_id: str, socket_id: str) -> None:
    """Set the socket ID that owns a profile in Redis."""
    redis_client = get_redis_client()
    socket_owner = get_socket_owner_dict()
    if not redis_client:
        # Fallback to in-memory storage
        socket_owner[profile_id] = socket_id
        return

    try:
        # Set with expiration (24 hours) to prevent stale data
        await redis_client.setex(f"socket_owner:{profile_id}", 86400, socket_id)
    except Exception as e:
        logger.error(f"Redis error setting socket owner for profile {profile_id}: {e}")
        # Fallback to in-memory storage
        socket_owner[profile_id] = socket_id
