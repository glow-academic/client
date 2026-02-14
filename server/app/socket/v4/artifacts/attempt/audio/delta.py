"""Attempt audio delta handler.

Handles internal event:
- generate_audio_delta: Translate to attempt_assistant_audio
"""

from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.attempt.audio_helpers import get_session_for_group
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.attempt.types import AttemptAssistantAudioEvent

internal_sio = get_internal_sio()

server_router = APIRouter()


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


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/attempt/assistant_audio", response_model=dict[str, bool])
async def attempt_assistant_audio_api(
    request: AttemptAssistantAudioEvent,
) -> dict[str, bool]:
    """Server-to-client event: Audio chunk from assistant in voice mode."""
    return {"success": True}
