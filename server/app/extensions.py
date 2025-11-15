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

# Redis client for shared infrastructure (HTTP caching, health checks, etc.)
redis_client: Any | None = None  # type: ignore


async def init_redis_client() -> None:
    """Initialize Redis client for shared infrastructure."""
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


async def cleanup_redis_client() -> None:
    """Clean up Redis client on shutdown."""
    global redis_client

    # Close Redis connection
    if redis_client:
        await redis_client.close()
        redis_client = None
        logger.info("Redis client closed")
