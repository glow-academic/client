"""Internal handler: generate_audio_response_cancelled → attempt_stopped.

Fired when OpenAI cancels the assistant's response (barge-in: user spoke
while assistant was still responding). Emits attempt_stopped so the client
stops audio playback and transcript rendering.

Also records token usage and re-enters the rate limit gate for the next turn.
"""

from typing import Any

from app.infra.websocket.session_store import get_session_by_group_id
from app.globals import get_internal_sio
from app.v5.socket.internal.attempt.types import AttemptStoppedData
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("generate_audio_response_cancelled")  # type: ignore
async def handle_response_cancelled(data: dict[str, Any]) -> None:
    """Handle barge-in cancellation: notify client + continue audio session."""
    group_id = data.get("group_id")
    if not group_id:
        return
    session = get_session_by_group_id(group_id)
    if not session:
        return

    sid = session.sid
    chat_id = session.chat_id

    logger.info(f"Response cancelled (barge-in) - group_id={group_id}")

    # Notify client to stop audio playback and transcript rendering
    await internal_sio.emit(
        "attempt_stopped",
        AttemptStoppedData(
            sid=sid,
            rooms=[sid, f"attempt_{chat_id}"],
            chat_id=chat_id,
            success=True,
            message=None,
        ).model_dump(mode="json"),
    )

    # Re-enter rate limit gate for the next turn (same as normal response.done)
    await internal_sio.emit(
        "generate",
        {
            "sid": sid,
            "artifact_types": data.get("artifact_types")
            or [{"name": data.get("artifact_type", ""), "operation": "get"}],
            "group_id": group_id,
            "metadata": data.get("metadata", {}),
        },
    )
