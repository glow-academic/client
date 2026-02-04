"""Client WebSocket handler for audio frames - queue producer/consumer."""

import asyncio
from typing import Any

from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.session_store import (
    get_session_by_group_id,
    get_session_by_sid,
)

internal_sio = get_internal_sio()


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


async def _client_ws_sender_task(sid: str, group_id: str) -> None:
    """Background task that drains outbound_queue and sends audio frames to client."""
    try:
        session = get_session_by_group_id(group_id)
        if not session:
            return

        while True:
            try:
                msg = await session.outbound_queue.get()

                if msg.get("type") == "audio":
                    pcm16_data = msg.get("pcm16")
                    if pcm16_data:
                        # Send binary audio frame to client
                        await sio.emit(
                            "simulation_voice_assistant_delta",
                            {
                                "audio": pcm16_data,  # Binary PCM16 data
                            },
                            room=sid,
                        )
            except asyncio.CancelledError:
                break
            except Exception:
                # Ignore errors and continue
                continue
    except Exception:
        # Task cleanup
        pass


# Start background sender task when session is created
# This will be called from audio.py after session creation
async def start_client_ws_sender(sid: str, group_id: str) -> None:
    """Start background task to send audio frames to client."""
    asyncio.create_task(_client_ws_sender_task(sid, group_id))
