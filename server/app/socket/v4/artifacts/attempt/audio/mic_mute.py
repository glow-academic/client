"""Attempt mic mute handler.

Handles WebSocket event:
- attempt_mic_mute: Toggle microphone mute state
"""

import logging
from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.session_store import (
    get_session_by_sid,
)
from app.main import sio
from app.socket.v4.artifacts.attempt.types import AttemptMicMutePayload

logger = logging.getLogger(__name__)

client_router = APIRouter()
server_router = APIRouter()


@sio.event  # type: ignore
async def attempt_mic_mute(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_mic_mute event - toggle microphone mute state."""
    try:
        payload = AttemptMicMutePayload(**data)

        session = get_session_by_sid(sid)
        if not session:
            logger.debug(f"No audio session for sid={sid}, ignoring mic mute")
            return

        # Push control message to inbound_queue
        await session.inbound_queue.put(
            {
                "type": "mic.set_muted",
                "muted": payload.muted,
            }
        )
    except Exception:
        pass


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/attempt/mic_mute", response_model=dict[str, bool])
async def attempt_mic_mute_api(request: AttemptMicMutePayload) -> dict[str, bool]:
    """Client-to-server event: Toggle microphone mute."""
    return {"success": True}
