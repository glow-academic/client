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
from app.socket.v4.artifacts.session_store import (
    get_session_by_run_id,
    get_session_by_sid,
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

        if not profile_id_str:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    chat_id=str(payload.chat_id),
                    type="audio",
                    message="Profile not found. Please reconnect.",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        chat_id = str(payload.chat_id)

        # Forward to existing simulation_voice_start handler via internal emit
        # The voice session will be created and managed by the existing infrastructure
        # For now, emit success - the actual voice session is started when the
        # first message is sent with voice_mode=True

        event = AttemptAudioReadyEvent(
            chat_id=chat_id,
            success=True,
            message="Voice session ready",
        )

        await sio.emit(
            "attempt_audio_ready",
            event.model_dump(mode="json"),
            room=sid,
        )

        # Log activity
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="attempt.audio.started",
                template="{{ actor.name }} started voice session",
                context={"chat_id": chat_id},
                endpoint="/socket/v4/attempt/audio_start",
                error=False,
            )
        except Exception:
            pass

    except Exception as e:
        logger.exception(f"Error in attempt_audio_start: {str(e)}")
        chat_id = data.get("chat_id", "")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                chat_id=str(chat_id) if chat_id else None,
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
        chat_id = str(payload.chat_id)

        # Remove voice session
        if chat_id in _voice_sessions:
            del _voice_sessions[chat_id]

        # Clear accumulated message IDs
        async with _voice_message_ids_lock:
            if chat_id in _voice_message_ids:
                del _voice_message_ids[chat_id]

        event = AttemptAudioEndedEvent(
            chat_id=chat_id,
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
                context={"chat_id": chat_id},
                endpoint="/socket/v4/attempt/audio_stop",
                error=False,
            )
        except Exception:
            pass

    except Exception as e:
        logger.exception(f"Error in attempt_audio_stop: {str(e)}")
        chat_id = data.get("chat_id", "")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                chat_id=str(chat_id) if chat_id else None,
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
        # Get session by sid
        session = get_session_by_sid(sid)
        if not session:
            # Try to get by run_id if provided
            run_id = data.get("run_id")
            if run_id:
                session = get_session_by_run_id(str(run_id))

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

        # Get session by sid
        session = get_session_by_sid(sid)
        if not session:
            # Try to get by run_id if provided
            run_id = data.get("run_id")
            if run_id:
                session = get_session_by_run_id(str(run_id))

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
