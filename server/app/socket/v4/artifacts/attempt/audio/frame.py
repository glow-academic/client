"""Attempt audio frame handler.

Handles WebSocket event:
- attempt_audio_frame: Send audio data to server
"""

import asyncio
import logging
from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.session_store import (
    get_session_by_sid,
)
from app.main import sio
from app.socket.v4.artifacts.attempt.types import AttemptAudioFramePayload

logger = logging.getLogger(__name__)

client_router = APIRouter()
server_router = APIRouter()


@sio.event  # type: ignore
async def attempt_audio_frame(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_audio_frame event - send audio data to server."""
    try:
        session = get_session_by_sid(sid)

        if not session:
            logger.debug(f"No audio session for sid={sid}, dropping frame")
            return

        # Extract audio data
        audio_data = data.get("audio")
        if not audio_data:
            return

        # Update activity timestamp
        import time

        session.last_activity = time.monotonic()

        # Push to inbound_queue — drop frame if queue is full (backpressure)
        try:
            session.inbound_queue.put_nowait(
                {
                    "type": "audio",
                    "pcm16_bytes": audio_data,
                }
            )
        except asyncio.QueueFull:
            pass  # Drop frame — client sending faster than processing
    except Exception:
        pass


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/attempt/audio_frame", response_model=dict[str, bool])
async def attempt_audio_frame_api(request: AttemptAudioFramePayload) -> dict[str, bool]:
    """Client-to-server event: Send audio frame data."""
    return {"success": True}
