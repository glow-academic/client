import logging
import os
from pathlib import Path
from typing import Optional

import redis.asyncio as redis  # type: ignore
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

CSV_FOLDER = BASE_FOLDER / "csv"
CSV_FOLDER.mkdir(parents=True, exist_ok=True)  # saving each csv as csv/token.ext

# Redis client for socket ownership management
redis_client: Optional[redis.Redis] = None

# Fallback in-memory storage for when Redis is unavailable
socket_owner: dict[str, str] = {}  # profile_id -> socket_id

async def init_redis_client() -> None:
    """Initialize Redis client for socket ownership management."""
    global redis_client
    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        try:
            client: redis.Redis = redis.from_url(redis_url)  # type: ignore
            # Test the connection
            await client.ping()
            redis_client = client
            logger.info(f"Redis client initialized successfully: {redis_url}")
        except Exception as e:
            logger.error(f"Failed to initialize Redis client: {e}")
            redis_client = None
    else:
        logger.warning("No REDIS_URL provided - socket ownership will use in-memory storage")
        redis_client = None

async def get_socket_owner(profile_id: str) -> Optional[str]:
    """Get the socket ID that owns a profile from Redis."""
    if not redis_client:
        # Fallback to in-memory storage
        return socket_owner.get(profile_id)
    
    try:
        owner_sid = await redis_client.get(f"socket_owner:{profile_id}")
        return owner_sid.decode('utf-8') if owner_sid else None
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

async def find_profile_by_socket(socket_id: str) -> Optional[str]:
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
            if owner_sid and owner_sid.decode('utf-8') == socket_id:
                profile_id = key.decode('utf-8').replace('socket_owner:', '')
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
    if redis_client:
        await redis_client.close()
        logger.info("Redis client closed")

# Active connections management (chat_id -> socket_id)
async def get_active_connection(chat_id: str) -> Optional[str]:
    """Get the socket ID for an active chat connection from Redis."""
    if not redis_client:
        return None
    
    try:
        connection_sid = await redis_client.get(f"active_connection:{chat_id}")
        return connection_sid.decode('utf-8') if connection_sid else None
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

async def find_chat_by_socket(socket_id: str) -> Optional[str]:
    """Find the chat ID for a socket ID."""
    if not redis_client:
        return None
    
    try:
        # Scan through all active connection keys to find the matching socket_id
        async for key in redis_client.scan_iter(match="active_connection:*"):
            connection_sid = await redis_client.get(key)
            if connection_sid and connection_sid.decode('utf-8') == socket_id:
                chat_id = key.decode('utf-8').replace('active_connection:', '')
                return chat_id  # type: ignore
        return None
    except Exception as e:
        logger.error(f"Redis error finding chat by socket {socket_id}: {e}")
        return None

# Active runs management (chat_id -> run_data)
async def get_active_run(chat_id: str) -> Optional[str]:
    """Get the active run data for a chat from Redis."""
    if not redis_client:
        return None
    
    try:
        run_data = await redis_client.get(f"active_run:{chat_id}")
        return run_data.decode('utf-8') if run_data else None
    except Exception as e:
        logger.error(f"Redis error getting active run for chat {chat_id}: {e}")
        return None

async def set_active_run(chat_id: str, run_data: str) -> None:
    """Set the active run data for a chat in Redis."""
    if not redis_client:
        return
    
    try:
        # Set with expiration (2 hours) to prevent stale data
        await redis_client.setex(f"active_run:{chat_id}", 7200, run_data)
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
