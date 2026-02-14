"""Attempt user speech delta handler.

Handles internal event:
- generate_user_speech_delta: Translate to attempt_user_delta
"""

from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.attempt.audio_helpers import get_session_for_group
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.attempt.types import AttemptUserDeltaEvent

internal_sio = get_internal_sio()

server_router = APIRouter()


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


@server_router.post("/attempt/user_delta", response_model=dict[str, bool])
async def attempt_user_delta_api(request: AttemptUserDeltaEvent) -> dict[str, bool]:
    """Server-to-client event: Voice transcription delta."""
    return {"success": True}
