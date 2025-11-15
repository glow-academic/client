"""Shared utilities for simulation WebSocket handlers."""

import logging

import socketio  # type: ignore

logger = logging.getLogger(__name__)


def get_sio_instance() -> socketio.AsyncServer:
    """Get the Socket.IO server instance from main.py"""
    from app.main import get_socketio_instance

    return get_socketio_instance()


async def emit_error(sid: str, message: str) -> None:
    """Helper function to emit error messages to a specific client"""
    sio_instance = get_sio_instance()
    await sio_instance.emit(
        "simulation_error", {"success": False, "message": message}, room=sid
    )
    logger.error(f"Emitted error to {sid}: {message}")
