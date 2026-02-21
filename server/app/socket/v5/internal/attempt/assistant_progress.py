"""Internal handler: generate_text_progress → attempt_progress(type=assistant_progress).

Streams assistant text deltas for attempt-related artifacts (chat/attempt).
Filters out grade-related generations (those with grade_id in metadata).
"""

from typing import Any

from app.main import get_internal_sio
from app.socket.v5.internal.attempt.types import AttemptAssistantProgressData

internal_sio = get_internal_sio()


@internal_sio.on("generate_text_progress")  # type: ignore
async def handle_attempt_assistant_progress(data: dict[str, Any]) -> None:
    """Translate text delta → attempt_progress(type=assistant_progress)."""
    artifact_type = data.get("artifact_type")
    if artifact_type not in ("chat", "attempt"):
        return
    metadata = data.get("metadata") or {}
    # Only for message generation (no grade_id)
    if metadata.get("grade_id"):
        return
    chat_id = metadata.get("chat_id", "")
    await internal_sio.emit(
        "attempt_assistant_progress",
        AttemptAssistantProgressData(
            sid=data.get("sid", ""),
            chat_id=chat_id,
            content_type="delta",
            content=data.get("delta", ""),
        ).model_dump(mode="json"),
    )
