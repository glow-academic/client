"""Remove the socket ownership for a profile from Redis."""


from app.utils.logging.db_logger import get_logger
from app.main import get_redis_client, get_socket_owner_dict

logger = get_logger(__name__)


async def remove_socket_owner(profile_id: str) -> None:
    """Remove the socket ownership for a profile from Redis."""
    redis_client = get_redis_client()
    socket_owner = get_socket_owner_dict()
    if not redis_client:
        # Fallback to in-memory storage
        socket_owner.pop(profile_id, None)
        return

    try:
        await redis_client.delete(f"socket_owner:{profile_id}")
    except Exception as e:
        logger.error(f"Redis error removing socket owner for profile {profile_id}: {e}")
        # Fallback to in-memory storage
        socket_owner.pop(profile_id, None)
