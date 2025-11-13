import logging
import os
from pathlib import Path
from typing import Any

# Guarded Redis import to prevent crashes when redis is not installed
try:
    import redis.asyncio as redis  # type: ignore
except ImportError:
    redis = None  # type: ignore # graceful fallback

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Detect container vs. host **without** relying on a .env entry
IN_DOCKER = os.getenv("DOCKER_ENV") == "1"

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BASE_FOLDER = Path("/app") if IN_DOCKER else PROJECT_ROOT
UPLOAD_FOLDER = BASE_FOLDER / "uploads"
UPLOAD_FOLDER.mkdir(
    parents=True, exist_ok=True
)  # saving each document as uploads/document_id.ext

# Redis client for socket ownership management
redis_client: Any | None = None  # type: ignore

# Fallback in-memory storage for when Redis is unavailable
socket_owner: dict[str, str] = {}  # profile_id -> socket_id


async def init_redis_client() -> None:
    """Initialize Redis client for socket ownership management."""
    global redis_client
    redis_url = os.getenv("REDIS_URL")
    if not redis or not redis_url:
        logger.warning(
            "Redis disabled (no lib or no REDIS_URL); using in-memory fallbacks"
        )
        redis_client = None
        return

    try:
        client = redis.from_url(redis_url)  # type: ignore
        await client.ping()
        redis_client = client
        logger.info(f"Redis client initialized: {redis_url}")
    except Exception as e:
        logger.error(f"Failed to initialize Redis client: {e}")
        redis_client = None


async def get_socket_owner(profile_id: str) -> str | None:
    """Get the socket ID that owns a profile from Redis."""
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


async def set_socket_owner(profile_id: str, socket_id: str) -> None:
    """Set the socket ID that owns a profile in Redis."""
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


async def remove_socket_owner(profile_id: str) -> None:
    """Remove the socket ownership for a profile from Redis."""
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


async def find_profile_by_socket(socket_id: str) -> str | None:
    """Find the profile ID owned by a socket ID."""
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


async def cleanup_redis_client() -> None:
    """Clean up Redis client on shutdown."""
    global redis_client

    # Close Redis connection
    if redis_client:
        await redis_client.close()
        redis_client = None
        logger.info("Redis client closed")


# Active connections management (chat_id -> socket_id)
async def get_active_connection(chat_id: str) -> str | None:
    """Get the socket ID for an active chat connection from Redis."""
    if not redis_client:
        return None

    try:
        connection_sid = await redis_client.get(f"active_connection:{chat_id}")
        return connection_sid.decode("utf-8") if connection_sid else None
    except Exception as e:
        logger.error(f"Redis error getting active connection for chat {chat_id}: {e}")
        return None


async def set_active_connection(chat_id: str, socket_id: str) -> None:
    """Set the socket ID for an active chat connection in Redis."""
    if not redis_client:
        return

    try:
        # Set with expiration (1 hour) to prevent stale data
        await redis_client.setex(f"active_connection:{chat_id}", 3600, socket_id)
    except Exception as e:
        logger.error(f"Redis error setting active connection for chat {chat_id}: {e}")


async def remove_active_connection(chat_id: str) -> None:
    """Remove an active chat connection from Redis."""
    if not redis_client:
        return

    try:
        await redis_client.delete(f"active_connection:{chat_id}")
    except Exception as e:
        logger.error(f"Redis error removing active connection for chat {chat_id}: {e}")


async def find_chat_by_socket(socket_id: str) -> str | None:
    """Find the chat ID for a socket ID."""
    if not redis_client:
        return None

    try:
        # Scan through all active connection keys to find the matching socket_id
        async for key in redis_client.scan_iter(match="active_connection:*"):
            connection_sid = await redis_client.get(key)
            if connection_sid and connection_sid.decode("utf-8") == socket_id:
                chat_id = key.decode("utf-8").replace("active_connection:", "")
                return chat_id  # type: ignore
        return None
    except Exception as e:
        logger.error(f"Redis error finding chat by socket {socket_id}: {e}")
        return None


async def find_chats_by_socket(socket_id: str) -> list[str]:
    """Find all chat IDs for a socket ID."""
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


# Active runs management with cooperative cancellation (chat_id -> run_id)
async def get_active_run(chat_id: str) -> str | None:
    """Get the active run ID for a chat from Redis."""
    if not redis_client:
        return None

    try:
        run_id = await redis_client.get(f"active_run:{chat_id}")
        return run_id.decode("utf-8") if run_id else None
    except Exception as e:
        logger.error(f"Redis error getting active run for chat {chat_id}: {e}")
        return None


async def set_active_run(chat_id: str, run_id: str) -> None:
    """Set the active run ID for a chat in Redis."""
    if not redis_client:
        return

    try:
        # Set with expiration (2 hours) to prevent stale data
        await redis_client.setex(f"active_run:{chat_id}", 7200, run_id)
    except Exception as e:
        logger.error(f"Redis error setting active run for chat {chat_id}: {e}")


async def remove_active_run(chat_id: str) -> None:
    """Remove an active run from Redis."""
    if not redis_client:
        return

    try:
        await redis_client.delete(f"active_run:{chat_id}")
    except Exception as e:
        logger.error(f"Redis error removing active run for chat {chat_id}: {e}")


async def cancel_active_run(chat_id: str) -> bool:
    """Cancel an active run using cooperative cancellation."""
    if not redis_client:
        return False

    try:
        run_id = await get_active_run(chat_id)
        if not run_id:
            return False

        # Set cancellation flag with TTL (5 minutes)
        await redis_client.setex(f"cancel_run:{run_id}", 300, "1")
        logger.info(f"Successfully cancelled active run {run_id} for chat {chat_id}")
        return True
    except Exception as e:
        logger.error(f"Error cancelling active run {chat_id}: {e}")
        return False


async def is_run_cancelled(run_id: str) -> bool:
    """Check if a run has been cancelled."""
    if not redis_client:
        return False

    try:
        cancelled = await redis_client.exists(f"cancel_run:{run_id}")
        return bool(cancelled)
    except Exception as e:
        logger.error(f"Redis error checking run cancellation for {run_id}: {e}")
        return False


# Guest management functions
async def add_guest_socket(socket_id: str) -> None:
    """Add a guest socket to Redis."""
    if not redis_client:
        return

    try:
        result = await redis_client.sadd("guest_sockets", socket_id)  # type: ignore
        _ = result  # Use result to avoid unused variable warning
    except Exception as e:
        logger.error(f"Redis error adding guest socket {socket_id}: {e}")


async def remove_guest_socket(socket_id: str) -> None:
    """Remove a guest socket from Redis."""
    if not redis_client:
        return

    try:
        result = await redis_client.srem("guest_sockets", socket_id)  # type: ignore
        _ = result  # Use result to avoid unused variable warning
    except Exception as e:
        logger.error(f"Redis error removing guest socket {socket_id}: {e}")


async def is_guest_socket(socket_id: str) -> bool:
    """Check if a socket is a guest socket."""
    if not redis_client:
        return False

    try:
        result = await redis_client.sismember("guest_sockets", socket_id)  # type: ignore
        return bool(result)
    except Exception as e:
        logger.error(f"Redis error checking guest socket {socket_id}: {e}")
        return False


async def increment_guest_count() -> int:
    """Increment guest connection count and return new total."""
    if not redis_client:
        return 0

    try:
        result = await redis_client.incr("guest_connection_count")
        return int(result) if result else 0
    except Exception as e:
        logger.error(f"Redis error incrementing guest count: {e}")
        return 0


async def decrement_guest_count() -> int:
    """Decrement guest connection count and return new total (floor at 0)."""
    if not redis_client:
        return 0

    try:
        # Get current count and ensure it doesn't go below 0
        current = await redis_client.get("guest_connection_count")
        cur = int(current) if current else 0
        if cur <= 0:
            await redis_client.set("guest_connection_count", 0)
            return 0
        result = await redis_client.decr("guest_connection_count")
        return int(result) if result else 0
    except Exception as e:
        logger.error(f"Redis error decrementing guest count: {e}")
        return 0


async def get_guest_count() -> int:
    """Get current guest connection count."""
    if not redis_client:
        return 0

    try:
        count = await redis_client.get("guest_connection_count")
        return int(count) if count else 0
    except Exception as e:
        logger.error(f"Redis error getting guest count: {e}")
        return 0
