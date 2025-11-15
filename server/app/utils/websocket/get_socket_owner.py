"""Get the socket ID that owns a profile from Redis."""

import logging

from app.main import get_redis_client, get_socket_owner_dict

logger = logging.getLogger(__name__)


async def get_socket_owner(profile_id: str) -> str | None:
    """Get the socket ID that owns a profile from Redis."""
    redis_client = get_redis_client()
    socket_owner = get_socket_owner_dict()
    if not redis_client:
        # Fallback to in-memory storage
        return socket_owner.get(profile_id)

    try:
        owner_sid = await redis_client.get(f"socket_owner:{profile_id}")
        return owner_sid.decode("utf-8") if owner_sid else None
    except Exception as e:
        logger.error(f"Redis error getting socket owner for profile {profile_id}: {e}")
        # Fallback to in-memory storage
        return socket_owner.get(profile_id)

