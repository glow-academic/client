"""Handle generate_text_progress — text generation streaming delta.

Attempt-specific: emits attempt_assistant_progress for chat/attempt artifacts
(filtered out for grade generations).
"""

from typing import Any

from app.main import get_internal_sio
from app.v5.socket.internal.attempt.types import AttemptAssistantProgressData
from app.v5.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("generate_text_progress")  # type: ignore
async def handle_text_progress(data: dict[str, Any]) -> None:
    """Handle text delta — emit attempt_assistant_progress for attempt artifacts."""
    artifact_type = data.get("artifact_type")
    if artifact_type not in ("chat", "attempt"):
        return
    metadata = data.get("metadata") or {}
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
