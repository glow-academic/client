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
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import (
    _voice_message_ids,
    _voice_message_ids_lock,
    _voice_sessions,
    get_internal_sio,
    sio,
)
from app.socket.v4.artifacts.adapters.audio.openai import OpenAIRealtimeAdapter
from app.sql.types import GetVoiceSessionContextSqlParams, GetVoiceSessionContextSqlRow
from app.utils.auth.decrypt_api_key import decrypt_api_key
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()
from app.infra.v4.websocket.session_store import (
    create_session,
    get_session_by_group_id,
    get_session_by_sid,
    remove_session,
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
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()

# SQL path for voice session context
SQL_PATH_VOICE_CONTEXT = (
    "app/sql/v4/queries/audio/get_voice_session_context_complete.sql"
)


# Global adapter instance (singleton)
_audio_adapter: OpenAIRealtimeAdapter | None = None


def get_audio_adapter() -> OpenAIRealtimeAdapter:
    """Get or create the audio adapter singleton."""
    global _audio_adapter
    if _audio_adapter is None:
        _audio_adapter = OpenAIRealtimeAdapter()
    return _audio_adapter


@sio.event  # type: ignore
async def attempt_audio_start(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_audio_start event - start a voice session.

    BFF Translation: Client sends chat_id, server generates group_id internally.
    Fetches voice configuration, initializes the audio adapter, and starts streaming.
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

        profile_id = uuid.UUID(profile_id_str)

        # Generate unique group_id for this voice session (like SQL does for text)
        group_id = str(uuid.uuid4())

        # Create session with BOTH identifiers - group_id for internal, chat_id for events
        session = create_session(sid, group_id, chat_id)

        # Store session reference by group_id for cleanup
        _voice_sessions[group_id] = {
            "sid": sid,
            "session": session,
        }

        # Fetch voice configuration from database
        async with get_db_connection() as conn:
            context_row = cast(
                GetVoiceSessionContextSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH_VOICE_CONTEXT,
                    params=GetVoiceSessionContextSqlParams(
                        p_profile_id=profile_id,
                        p_chat_id=payload.chat_id,
                    ),
                ),
            )

            if not context_row:
                await sio.emit(
                    "attempt_error",
                    AttemptUnifiedErrorEvent(
                        group_id=group_id,
                        type="audio",
                        message="Failed to fetch voice configuration",
                    ).model_dump(mode="json"),
                    room=sid,
                )
                return

            # Get API key from settings
            encrypted_api_key = context_row.api_key
            if not encrypted_api_key:
                await sio.emit(
                    "attempt_error",
                    AttemptUnifiedErrorEvent(
                        group_id=group_id,
                        type="audio",
                        message="No API key configured for voice mode",
                    ).model_dump(mode="json"),
                    room=sid,
                )
                return

            # Decrypt API key
            try:
                api_key = decrypt_api_key(encrypted_api_key)
            except Exception as e:
                logger.exception(f"Failed to decrypt API key: {e}")
                await sio.emit(
                    "attempt_error",
                    AttemptUnifiedErrorEvent(
                        group_id=group_id,
                        type="audio",
                        message="Failed to decrypt API key",
                    ).model_dump(mode="json"),
                    room=sid,
                )
                return

            # Use realtime model (hardcoded for MVP - can be made configurable later)
            model_name = "gpt-4o-realtime-preview-2024-12-17"

            # Initialize the audio adapter
            adapter = get_audio_adapter()
            try:
                await adapter.initialize_session(
                    session=session,
                    api_key=api_key,
                    model=model_name,
                    voice="alloy",  # Default voice
                    instructions=None,  # Can be enhanced later
                )
            except Exception as e:
                logger.exception(f"Failed to initialize audio adapter: {e}")
                # Clean up session on failure
                _voice_sessions.pop(group_id, None)
                remove_session(group_id)
                await sio.emit(
                    "attempt_error",
                    AttemptUnifiedErrorEvent(
                        group_id=group_id,
                        type="audio",
                        message=f"Failed to connect to voice service: {str(e)}",
                    ).model_dump(mode="json"),
                    room=sid,
                )
                return

        # Emit success event
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

        logger.info(
            f"Audio session started - chat_id={chat_id}, group_id={group_id}, model={model_name}"
        )

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
    Stops the audio adapter and cleans up resources.
    Emits attempt_audio_ended with chat_id on success.
    """
    try:
        payload = AttemptAudioStopPayload(**data)
        chat_id = str(payload.chat_id)

        # Look up session by sid to get the group_id
        session = get_session_by_sid(sid)
        group_id = session.group_id if session else None

        if group_id and session:
            # Stop the audio adapter
            adapter = get_audio_adapter()
            try:
                await adapter.stop_session(session)
            except Exception as e:
                logger.warning(f"Error stopping audio adapter: {e}")

            # Get and remove voice session
            _voice_sessions.pop(group_id, None)

            # Remove from session store (cleans up by both sid and group_id)
            remove_session(group_id)
            logger.info(
                f"Audio session stopped - chat_id={chat_id}, group_id={group_id}"
            )

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

    # Use mode="python" so bytes stay as bytes — Socket.IO natively
    # sends binary attachments alongside the JSON packet (no base64 needed).
    await sio.emit(
        "attempt_assistant_audio",
        {"chat_id": session.chat_id, "audio": audio_data},
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


@internal_sio.on("generate_audio_error")  # type: ignore
async def handle_generate_audio_error(data: dict[str, Any]) -> None:
    """Handle generate_audio_error - translate to attempt_error.

    BFF Translation: group_id from internal event -> chat_id for client event.
    """
    group_id = data.get("group_id")
    if not group_id:
        return

    session = get_session_for_group(group_id)
    if not session:
        return

    error_message = data.get("error_message", "Unknown audio error")

    await sio.emit(
        "attempt_error",
        AttemptUnifiedErrorEvent(
            group_id=group_id,
            type="audio",
            message=error_message,
        ).model_dump(mode="json"),
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
async def attempt_assistant_audio_api(
    request: AttemptAssistantAudioEvent,
) -> dict[str, bool]:
    """Server-to-client event: Audio chunk from assistant in voice mode."""
    return {"success": True}
