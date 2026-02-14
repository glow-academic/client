"""Audio frame send handler.

Handles WebSocket event:
- audio_frame_send: Send audio frames from client to server
"""

from typing import Any

from app.infra.v4.websocket.session_store import (
    get_session_by_group_id,
    get_session_by_sid,
)
from app.main import sio


@sio.event  # type: ignore
async def audio_frame_send(sid: str, data: dict[str, Any]) -> None:
    """Handle audio_frame_send event from client - push to inbound_queue."""
    try:
        # Get session by sid or group_id
        session = get_session_by_sid(sid)
        if not session:
            # Try to get by group_id if provided
            group_id = data.get("group_id")
            if group_id:
                session = get_session_by_group_id(str(group_id))

        if not session:
            # Session not found - ignore silently (session may not be initialized yet)
            return

        # Extract audio data (can be binary ArrayBuffer or base64 string)
        audio_data = data.get("audio")
        if not audio_data:
            return

        # Push to inbound_queue
        await session.inbound_queue.put(
            {
                "type": "audio",
                "pcm16_bytes": audio_data,  # Will be handled as binary or base64 in uplink loop
            }
        )
    except Exception:
        # Ignore errors - session may not exist or be closed
        pass
