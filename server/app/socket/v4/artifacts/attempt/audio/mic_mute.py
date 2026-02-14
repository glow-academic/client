"""Attempt mic mute handler.

Handles WebSocket event:
- attempt_mic_mute: Toggle microphone mute state
"""

from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.session_store import (
    get_session_by_group_id,
    get_session_by_sid,
)
from app.main import (
    _voice_sessions,
    sio,
)
from app.socket.v4.artifacts.attempt.types import AttemptMicMutePayload

client_router = APIRouter()
server_router = APIRouter()


@sio.event  # type: ignore
async def attempt_mic_mute(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_mic_mute event - toggle microphone mute state."""
    try:
        payload = AttemptMicMutePayload(**data)

        # Get session by sid first
        session = get_session_by_sid(sid)

        if not session:
            # Try to get by group_id if provided
            group_id = data.get("group_id")
            if group_id:
                session = get_session_by_group_id(str(group_id))
                # Also check _voice_sessions by group_id
                if not session:
                    session_data = _voice_sessions.get(str(group_id))
                    if session_data:
                        session = session_data.get("session")

        if not session:
            # Session not found - ignore silently
            return

        # Push control message to inbound_queue
        await session.inbound_queue.put(
            {
                "type": "mic.set_muted",
                "muted": payload.muted,
            }
        )
    except Exception:
        # Ignore errors - session may not exist or be closed
        pass


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/attempt/mic_mute", response_model=dict[str, bool])
async def attempt_mic_mute_api(request: AttemptMicMutePayload) -> dict[str, bool]:
    """Client-to-server event: Toggle microphone mute."""
    return {"success": True}
