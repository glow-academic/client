"""Internal handler: attempt_user_received_progress → attempt_user_progress.

Pass-through for audio transcription streaming. No DB write needed.
Text path skips this event entirely.
"""

from typing import Any

from app.infra.globals import get_internal_sio
from app.routes.v5.socket.internal.attempt.types import AttemptUserProgressData

internal_sio = get_internal_sio()


@internal_sio.on("attempt_user_received_progress")  # type: ignore
async def handle_user_received_progress(data: dict[str, Any]) -> None:
    """Forward transcript progress to server/ layer."""
    sid = data.get("sid", "")
    chat_id = data.get("chat_id", "")
    if not sid or not chat_id:
        return

    await internal_sio.emit(
        "attempt_user_progress",
        AttemptUserProgressData(
            sid=sid,
            chat_id=chat_id,
            item_id=data.get("item_id"),
            transcript=data.get("transcript", ""),
            rooms=data.get("rooms"),
        ).model_dump(mode="json"),
    )
