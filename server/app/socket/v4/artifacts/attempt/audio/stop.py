"""Attempt audio stop handler.

Handles WebSocket event:
- attempt_audio_stop: Stop a voice session
"""

from typing import Any

from fastapi import APIRouter

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.session_store import (
    get_session_by_sid,
    remove_session,
)
from app.main import (
    _voice_message_ids,
    _voice_message_ids_lock,
    _voice_sessions,
    sio,
)
from app.infra.v4.websocket.attempt.audio_helpers import get_audio_adapter
from app.socket.v4.artifacts.attempt.types import (
    AttemptAudioEndedEvent,
    AttemptAudioStopPayload,
    AttemptUnifiedErrorEvent,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


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


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/attempt/audio_stop", response_model=dict[str, bool])
async def attempt_audio_stop_api(request: AttemptAudioStopPayload) -> dict[str, bool]:
    """Client-to-server event: Stop a voice session."""
    return {"success": True}


@server_router.post("/attempt/audio_ended", response_model=dict[str, bool])
async def attempt_audio_ended_api(request: AttemptAudioEndedEvent) -> dict[str, bool]:
    """Server-to-client event: Voice session ended."""
    return {"success": True}
