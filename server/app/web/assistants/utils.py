"""Shared utilities for assistant WebSocket handlers."""

import logging

from app.main import sio

logger = logging.getLogger(__name__)


async def emit_assistant_error(sid: str, message: str) -> None:
    """Helper function to emit assistant error messages to a specific client"""
    await sio.emit(
        "assistant_error", {"success": False, "message": message}, room=sid
    )
    logger.error(f"Emitted assistant error to {sid}: {message}")

