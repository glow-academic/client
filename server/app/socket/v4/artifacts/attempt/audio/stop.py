"""Attempt audio stop — domain translator.

The generic audio_stop handler (audio_session.py) emits generate_audio_ended.
This module translates that internal event into the attempt-specific
attempt_audio_ended client event, resolving chat_id from the session.
"""

from typing import Any

from fastapi import APIRouter

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.session_store import get_session_by_group_id
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.attempt.types import (
    AttemptAudioEndedEvent,
    AttemptAudioStopPayload,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_audio_complete")  # type: ignore
async def handle_audio_complete(data: dict[str, Any]) -> None:
    """Translate generate_audio_complete → attempt_audio_ended for client."""
    sid = data.get("sid")
    group_id = data.get("group_id")
    if not sid:
        return
    session = get_session_by_group_id(group_id) if group_id else None
    chat_id = session.chat_id if session else (group_id or "")
    await sio.emit(
        "attempt_audio_ended",
        AttemptAudioEndedEvent(
            chat_id=chat_id, success=True, message="Voice session stopped"
        ).model_dump(mode="json"),
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
