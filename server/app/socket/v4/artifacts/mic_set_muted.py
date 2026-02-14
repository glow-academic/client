"""Mic set muted handler.

Handles WebSocket event:
- mic_set_muted: Toggle microphone mute from client
"""

from typing import Any

from app.infra.v4.websocket.session_store import (
    get_session_by_group_id,
    get_session_by_sid,
)
from app.main import sio


@sio.event  # type: ignore
async def mic_set_muted(sid: str, data: dict[str, Any]) -> None:
    """Handle mic.set_muted event from client - push control message to inbound_queue."""
    try:
        # Get session by sid or group_id
        session = get_session_by_sid(sid)
        if not session:
            # Try to get by group_id if provided
            group_id = data.get("group_id")
            if group_id:
                session = get_session_by_group_id(str(group_id))

        if not session:
            # Session not found - ignore silently
            return

        # Push control message to inbound_queue
        muted = data.get("muted", False)
        await session.inbound_queue.put(
            {
                "type": "mic.set_muted",
                "muted": muted,
            }
        )
    except Exception:
        # Ignore errors - session may not exist or be closed
        pass
