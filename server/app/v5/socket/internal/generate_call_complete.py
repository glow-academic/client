"""Handle generate_call_complete — tool call finalized.

Attempt-specific:
- Emits attempt_assistant_hints when tool result contains hints (entry_type == "hints").
- Emits attempt_grade_progress for per-criterion grade results (grade_id in metadata).

Run-level completion (tokens, auto-save, multi-agent) is handled by generate_run_complete.
"""

from typing import Any

from app.main import get_internal_sio
from app.v5.socket.internal.attempt.types import (
    AttemptAssistantHintsData,
    AttemptGradeProgressData,
)
from app.v5.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_call_complete(data: dict[str, Any]) -> None:
    """Handle tool call complete — emit attempt-specific events."""
    event_type = data.get("event_type")
    if event_type != "tool_result":
        return

    artifact_type = data.get("artifact_type")
    if artifact_type not in ("chat", "attempt"):
        return

    metadata = data.get("metadata") or {}
    sid = data.get("sid", "")

    # Hints extraction
    if data.get("entry_type") == "hints":
        result = data.get("result") or {}
        await internal_sio.emit(
            "attempt_assistant_hints",
            AttemptAssistantHintsData(
                sid=sid,
                chat_id=metadata.get("chat_id", ""),
                hints=result.get("hints", []),
            ).model_dump(mode="json"),
        )

    # Grade progress (per-criterion)
    if metadata.get("grade_id"):
        result = data.get("result") or {}
        await internal_sio.emit(
            "attempt_grade_progress",
            AttemptGradeProgressData(
                sid=sid,
                chat_id=metadata.get("chat_id", ""),
                grade_id=metadata.get("grade_id", ""),
                resource_type=data.get("resource_type", ""),
                entry=result,
            ).model_dump(mode="json"),
        )
