"""Attempt audio handlers for voice mode.

Handles WebSocket events for voice functionality:
- attempt_audio_start: Start a voice session
- attempt_audio_stop: Stop a voice session
- attempt_audio_frame: Send audio frames
- attempt_mic_mute: Toggle microphone mute

These handlers wrap the existing frames.py functionality with the unified attempt_* event contract.

BFF Translation Layer:
- Client sends chat_id (simple, intuitive API)
- Server generates group_id internally for session management
- AudioSession stores both for bidirectional mapping
- Events emitted back to client use chat_id
"""

import uuid
from typing import Any

from fastapi import APIRouter

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import (
    _voice_message_ids,
    _voice_message_ids_lock,
    _voice_sessions,
    get_internal_sio,
    sio,
)

internal_sio = get_internal_sio()
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

    BFF Translation: Client sends chat_id, server generates group_id internally.
    Emits attempt_audio_ready with chat_id on success.
    """
    try:
        payload = AttemptAudioStartPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        chat_id = str(payload.chat_id)

        if not profile_id_str:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    group_id=None,
                    type="audio",
                    message="Profile not found. Please reconnect.",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        # Generate unique group_id for this voice session (like SQL does for text)
        group_id = str(uuid.uuid4())

        # Create session with BOTH identifiers - group_id for internal, chat_id for events
        session = create_session(sid, group_id, chat_id)

        # Store session reference by group_id for cleanup
        _voice_sessions[group_id] = {
            "sid": sid,
            "session": session,
        }

        # Note: Outbound audio is handled via internal_sio events (generate_audio_delta)
        # which are translated to attempt_assistant_audio by the listener below

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

        logger.info(f"Audio session started - chat_id={chat_id}, group_id={group_id}")

        # Log activity
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="attempt.audio.started",
                template="{{ actor.name }} started voice session",
                context={"chat_id": chat_id, "group_id": group_id},
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
                group_id=None,
                type="audio",
                message=f"Failed to start voice session: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


@sio.event  # type: ignore
async def attempt_audio_stop(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_audio_stop event - stop a voice session.

    BFF Translation: Client sends chat_id, we look up session by sid to get group_id.
    Emits attempt_audio_ended with chat_id on success.
    """
    try:
        payload = AttemptAudioStopPayload(**data)
        chat_id = str(payload.chat_id)

        # Look up session by sid to get the group_id
        session = get_session_by_sid(sid)
        group_id = session.group_id if session else None

        if group_id:
            # Get and remove voice session
            session_data = _voice_sessions.pop(group_id, None)
            if session_data:
                # Remove from session store (cleans up by both sid and group_id)
                remove_session(group_id)
                logger.info(f"Audio session stopped - chat_id={chat_id}, group_id={group_id}")

            # Clear accumulated message IDs for this group
            async with _voice_message_ids_lock:
                if group_id in _voice_message_ids:
                    del _voice_message_ids[group_id]

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
                context={"chat_id": chat_id, "group_id": group_id},
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
                group_id=None,
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


async def emit_audio_delta(group_id: str, audio_data: bytes) -> bool:
    """Emit audio delta via internal event bus.

    This is the preferred way for audio producers (e.g., OpenAI Realtime API)
    to send audio to clients. The internal event is translated to domain-specific
    events by the listener below.

    Returns True if emitted, False if no session exists.
    """
    session = get_session_for_group(group_id)
    if not session:
        return False

    await internal_sio.emit(
        "generate_audio_delta",
        {
            "group_id": group_id,
            "audio": audio_data,
        },
    )
    return True


async def emit_user_speech_start(group_id: str, item_id: str) -> bool:
    """Emit user speech start via internal event bus.

    Called when user speech is detected in voice mode.
    """
    session = get_session_for_group(group_id)
    if not session:
        return False

    await internal_sio.emit(
        "generate_user_speech_start",
        {
            "group_id": group_id,
            "item_id": item_id,
        },
    )
    return True


async def emit_user_speech_delta(group_id: str, item_id: str, transcript: str) -> bool:
    """Emit user speech transcript delta via internal event bus.

    Called during voice transcription with incremental updates.
    """
    session = get_session_for_group(group_id)
    if not session:
        return False

    await internal_sio.emit(
        "generate_user_speech_delta",
        {
            "group_id": group_id,
            "item_id": item_id,
            "transcript": transcript,
        },
    )
    return True


# =============================================================================
# Internal Event Listeners (BFF Translation Layer)
# =============================================================================
# These listeners receive generic internal events and translate them to
# domain-specific client events, mapping group_id -> chat_id.
# =============================================================================


@internal_sio.on("generate_audio_delta")  # type: ignore
async def handle_generate_audio_delta(data: dict[str, Any]) -> None:
    """Handle generate_audio_delta - translate to attempt_assistant_audio.

    BFF Translation: group_id from internal event -> chat_id for client event.
    """
    group_id = data.get("group_id")
    if not group_id:
        return

    session = get_session_for_group(group_id)
    if not session:
        return

    audio_data = data.get("audio")
    if not audio_data:
        return

    event = AttemptAssistantAudioEvent(
        chat_id=session.chat_id,
        audio=audio_data,
    )

    await sio.emit(
        "attempt_assistant_audio",
        event.model_dump(mode="json"),
        room=session.sid,
    )


@internal_sio.on("generate_user_speech_start")  # type: ignore
async def handle_generate_user_speech_start(data: dict[str, Any]) -> None:
    """Handle generate_user_speech_start - translate to attempt_user_start.

    BFF Translation: group_id from internal event -> chat_id for client event.
    """
    group_id = data.get("group_id")
    if not group_id:
        return

    session = get_session_for_group(group_id)
    if not session:
        return

    item_id = data.get("item_id")
    if not item_id:
        return

    event = AttemptUserStartEvent(
        chat_id=session.chat_id,
        item_id=item_id,
    )

    await sio.emit(
        "attempt_user_start",
        event.model_dump(mode="json"),
        room=session.sid,
    )


@internal_sio.on("generate_user_speech_delta")  # type: ignore
async def handle_generate_user_speech_delta(data: dict[str, Any]) -> None:
    """Handle generate_user_speech_delta - translate to attempt_user_delta.

    BFF Translation: group_id from internal event -> chat_id for client event.
    """
    group_id = data.get("group_id")
    if not group_id:
        return

    session = get_session_for_group(group_id)
    if not session:
        return

    item_id = data.get("item_id")
    transcript = data.get("transcript", "")

    if not item_id:
        return

    event = AttemptUserDeltaEvent(
        chat_id=session.chat_id,
        item_id=item_id,
        transcript=transcript,
    )

    await sio.emit(
        "attempt_user_delta",
        event.model_dump(mode="json"),
        room=session.sid,
    )


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
