"""Shared utilities for run management (assistants and simulations)."""

import logging

from app.extensions import redis_client

logger = logging.getLogger(__name__)


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

