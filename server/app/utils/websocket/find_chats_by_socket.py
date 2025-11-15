"""Find all chat IDs for a socket ID."""

import logging

from app.main import get_redis_client

logger = logging.getLogger(__name__)


async def find_chats_by_socket(socket_id: str) -> list[str]:
    """Find all chat IDs for a socket ID."""
    redis_client = get_redis_client()
    if not redis_client:
        return []

    chats = []
    try:
        # Scan through all active connection keys to find the matching socket_id
        async for key in redis_client.scan_iter(match="active_connection:*"):
            connection_sid = await redis_client.get(key)
            if connection_sid and connection_sid.decode("utf-8") == socket_id:
                chat_id = key.decode("utf-8").replace("active_connection:", "")
                chats.append(chat_id)  # type: ignore
        return chats
    except Exception as e:
        logger.error(f"Redis error finding chats by socket {socket_id}: {e}")
        return []

