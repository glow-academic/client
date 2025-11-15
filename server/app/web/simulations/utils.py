"""Shared utilities for simulation WebSocket handlers."""

import logging

from app.main import sio

logger = logging.getLogger(__name__)


async def emit_error(sid: str, message: str) -> None:
    """Helper function to emit error messages to a specific client"""
    await sio.emit(
        "simulation_error", {"success": False, "message": message}, room=sid
    )
    logger.error(f"Emitted error to {sid}: {message}")
