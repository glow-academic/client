"""Find the profile ID owned by a socket ID."""

from app.main import get_redis_client, get_socket_owner_dict
from utils.logging.db_logger import get_logger

logger = get_logger(__name__)


async def find_profile_by_socket(socket_id: str) -> str | None:
    """Find the profile ID owned by a socket ID."""
    redis_client = get_redis_client()
    socket_owner = get_socket_owner_dict()
    if not redis_client:
        # Fallback to in-memory storage
        for profile_id, sid in socket_owner.items():
            if sid == socket_id:
                return profile_id
        return None

    try:
        # Scan through all socket ownership keys to find the matching socket_id
        async for key in redis_client.scan_iter(match="socket_owner:*"):
            owner_sid = await redis_client.get(key)
            if owner_sid and owner_sid.decode("utf-8") == socket_id:
                profile_id = key.decode("utf-8").replace("socket_owner:", "")
                return profile_id  # type: ignore
        return None
    except Exception as e:
        logger.error(f"Redis error finding profile by socket {socket_id}: {e}")
        # Fallback to in-memory storage
        for profile_id, sid in socket_owner.items():
            if sid == socket_id:
                return profile_id
        return None
