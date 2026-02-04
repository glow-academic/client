"""Attempt audio handlers for voice mode.

Handles WebSocket events for voice functionality:
- attempt_audio_start: Start a voice session
- attempt_audio_stop: Stop a voice session
- attempt_audio_frame: Send audio frames
- attempt_mic_mute: Toggle microphone mute

These handlers wrap the existing frames.py functionality with the unified attempt_* event contract.
"""

from typing import Any

from fastapi import APIRouter

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import (
    _voice_message_ids,
    _voice_message_ids_lock,
    _voice_sessions,
    sio,
)
from app.socket.v4.artifacts.attempt.types import (
    AttemptAssistantAudioEvent,
    AttemptAudioEndedEvent,
    AttemptAudioFramePayload,
    AttemptAudioReadyEvent,
    AttemptAudioStartPayload,
    AttemptAudioStopPayload,
    AttemptMicMutePayload,
    AttemptUnifiedErrorEvent,
    AttemptUserDeltaEvent,
    AttemptUserStartEvent,
)
from app.socket.v4.artifacts.frames import start_client_ws_sender
from app.socket.v4.artifacts.session_store import (
    create_session,
    get_session_by_group_id,
    get_session_by_sid,
    remove_session,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


@sio.event  # type: ignore
async def attempt_audio_start(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_audio_start event - start a voice session.

    Emits attempt_audio_ready on success.
    """
    try:
        payload = AttemptAudioStartPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        group_id = str(payload.group_id)

        if not profile_id_str:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    group_id=group_id,
                    type="audio",
                    message="Profile not found. Please reconnect.",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        # Create audio session (keyed by group_id)
        session = create_session(sid, group_id)

        # Store session reference by group_id for cleanup
        _voice_sessions[group_id] = {
            "sid": sid,
            "session": session,
        }

        # Start the background task to send audio frames to client
        await start_client_ws_sender(sid, group_id)

        event = AttemptAudioReadyEvent(
            group_id=group_id,
            success=True,
            message="Voice session ready",
        )

        await sio.emit(
            "attempt_audio_ready",
            event.model_dump(mode="json"),
            room=sid,
        )

        logger.info(f"Audio session started - group_id={group_id}")

        # Log activity
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="attempt.audio.started",
                template="{{ actor.name }} started voice session",
                context={"group_id": group_id},
                endpoint="/socket/v4/attempt/audio_start",
                error=False,
            )
        except Exception:
            pass

    except Exception as e:
        logger.exception(f"Error in attempt_audio_start: {str(e)}")
        group_id = data.get("group_id", "")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                group_id=str(group_id) if group_id else None,
                type="audio",
                message=f"Failed to start voice session: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


@sio.event  # type: ignore
async def attempt_audio_stop(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_audio_stop event - stop a voice session.

    Emits attempt_audio_ended on success.
    """
    try:
        payload = AttemptAudioStopPayload(**data)
        group_id = str(payload.group_id)

        # Get and remove voice session
        session_data = _voice_sessions.pop(group_id, None)
        if session_data:
            # Remove from session store (cleans up by both sid and group_id)
            remove_session(group_id)
            logger.info(f"Audio session stopped - group_id={group_id}")

        # Clear accumulated message IDs for this group
        async with _voice_message_ids_lock:
            if group_id in _voice_message_ids:
                del _voice_message_ids[group_id]

        event = AttemptAudioEndedEvent(
            group_id=group_id,
            success=True,
            message="Voice session stopped",
        )

        await sio.emit(
            "attempt_audio_ended",
            event.model_dump(mode="json"),
            room=sid,
        )

        # Log activity
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="attempt.audio.stopped",
                template="{{ actor.name }} stopped voice session",
                context={"group_id": group_id},
                endpoint="/socket/v4/attempt/audio_stop",
                error=False,
            )
        except Exception:
            pass

    except Exception as e:
        logger.exception(f"Error in attempt_audio_stop: {str(e)}")
        group_id = data.get("group_id", "")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                group_id=str(group_id) if group_id else None,
                type="audio",
                message=f"Failed to stop voice session: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


@sio.event  # type: ignore
async def attempt_audio_frame(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_audio_frame event - send audio data to server.

    This wraps the existing audio_frame_send functionality.
    """
    try:
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
            # Session not found - ignore silently (session may not be initialized yet)
            return

        # Extract audio data
        audio_data = data.get("audio")
        if not audio_data:
            return

        # Push to inbound_queue
        await session.inbound_queue.put(
            {
                "type": "audio",
                "pcm16_bytes": audio_data,
            }
        )
    except Exception:
        # Ignore errors - session may not exist or be closed
        pass


@sio.event  # type: ignore
async def attempt_mic_mute(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_mic_mute event - toggle microphone mute state.

    This wraps the existing mic.set_muted functionality.
    """
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
# Helper functions for audio generation
# =============================================================================


def get_session_for_group(group_id: str):
    """Get the audio session for a group_id.

    Returns the AudioSession if one exists, None otherwise.
    """
    # First try session store
    session = get_session_by_group_id(group_id)
    if session:
        return session

    # Fallback to _voice_sessions
    session_data = _voice_sessions.get(group_id)
    if session_data:
        return session_data.get("session")
    return None


async def push_audio_to_session(group_id: str, audio_data: bytes) -> bool:
    """Push audio data to a group's audio session outbound queue.

    This is called by the generation pipeline when audio is produced.
    Returns True if audio was pushed, False if no session exists.
    """
    session = get_session_for_group(group_id)
    if not session:
        return False

    await session.outbound_queue.put(
        {
            "type": "audio",
            "pcm16": audio_data,
        }
    )
    return True


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/attempt/audio_start", response_model=dict[str, bool])
async def attempt_audio_start_api(request: AttemptAudioStartPayload) -> dict[str, bool]:
    """Client-to-server event: Start a voice session."""
    return {"success": True}


@client_router.post("/attempt/audio_stop", response_model=dict[str, bool])
async def attempt_audio_stop_api(request: AttemptAudioStopPayload) -> dict[str, bool]:
    """Client-to-server event: Stop a voice session."""
    return {"success": True}


@client_router.post("/attempt/audio_frame", response_model=dict[str, bool])
async def attempt_audio_frame_api(request: AttemptAudioFramePayload) -> dict[str, bool]:
    """Client-to-server event: Send audio frame data."""
    return {"success": True}


@client_router.post("/attempt/mic_mute", response_model=dict[str, bool])
async def attempt_mic_mute_api(request: AttemptMicMutePayload) -> dict[str, bool]:
    """Client-to-server event: Toggle microphone mute."""
    return {"success": True}


@server_router.post("/attempt/audio_ready", response_model=dict[str, bool])
async def attempt_audio_ready_api(request: AttemptAudioReadyEvent) -> dict[str, bool]:
    """Server-to-client event: Voice session is ready."""
    return {"success": True}


@server_router.post("/attempt/audio_ended", response_model=dict[str, bool])
async def attempt_audio_ended_api(request: AttemptAudioEndedEvent) -> dict[str, bool]:
    """Server-to-client event: Voice session ended."""
    return {"success": True}


@server_router.post("/attempt/user_start", response_model=dict[str, bool])
async def attempt_user_start_api(request: AttemptUserStartEvent) -> dict[str, bool]:
    """Server-to-client event: User speech detected in voice mode."""
    return {"success": True}


@server_router.post("/attempt/user_delta", response_model=dict[str, bool])
async def attempt_user_delta_api(request: AttemptUserDeltaEvent) -> dict[str, bool]:
    """Server-to-client event: Voice transcription delta."""
    return {"success": True}


@server_router.post("/attempt/assistant_audio", response_model=dict[str, bool])
async def attempt_assistant_audio_api(request: AttemptAssistantAudioEvent) -> dict[str, bool]:
    """Server-to-client event: Audio chunk from assistant in voice mode."""
    return {"success": True}
