"""Client WebSocket handler for audio frames - queue producer/consumer.

Handles inbound audio frames from client to server.
Outbound audio is handled via internal_sio events (see documentation below).
"""

from typing import Any

from app.main import sio
from app.infra.v4.websocket.session_store import (
    get_session_by_group_id,
    get_session_by_sid,
)


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


# =============================================================================
# Generic Audio Event Emission (for realtime audio producers)
# =============================================================================
#
# Audio producers (e.g., OpenAI Realtime API) should emit generic events via internal_sio:
#
#   await internal_sio.emit("generate_audio_delta", {
#       "group_id": group_id,
#       "audio": pcm16_bytes,
#   })
#
#   await internal_sio.emit("generate_user_speech_start", {
#       "group_id": group_id,
#       "item_id": item_id,
#   })
#
#   await internal_sio.emit("generate_user_speech_delta", {
#       "group_id": group_id,
#       "item_id": item_id,
#       "transcript": transcript,
#   })
#
# Domain handlers (e.g., attempt/audio.py) listen for these generic events,
# look up the session by group_id, and emit domain-specific events with chat_id.
# =============================================================================
