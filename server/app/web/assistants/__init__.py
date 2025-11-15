"""Assistant WebSocket event router."""

import logging
from typing import Any

import socketio  # type: ignore

from app.web.assistants.send_message import handle_send_assistant_message
from app.web.assistants.start import handle_start_assistant
from app.web.assistants.stop import handle_stop_assistant

logger = logging.getLogger(__name__)


def register_assistant_events(sio: socketio.AsyncServer) -> None:
    """Register all assistant WebSocket event handlers"""

    logger.info("Starting registration of assistant WebSocket event handlers")

    @sio.event  # type: ignore
    async def start_assistant(sid: str, data: dict[str, Any]) -> None:
        """Start a new assistant chat"""
        logger.info(
            f"start_assistant event triggered for sid={sid} with data keys: {list(data.keys())}"
        )
        await handle_start_assistant(sid, data)

    @sio.event  # type: ignore
    async def stop_assistant(sid: str, data: dict[str, Any]) -> None:
        """Stop an active assistant"""
        await handle_stop_assistant(sid, data)

    @sio.event  # type: ignore
    async def send_assistant_message(sid: str, data: dict[str, Any]) -> None:
        """Send a message to the assistant"""
        await handle_send_assistant_message(sid, data)

    logger.info("Successfully registered assistant WebSocket event handlers")

