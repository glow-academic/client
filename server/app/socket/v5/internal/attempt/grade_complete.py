"""Internal handler: generate_text_complete/generate_call_complete → attempt_progress(type=grade_complete).

Fires on run_complete for attempt-related artifacts when grade_id is present in metadata.
"""

from typing import Any

from app.main import get_internal_sio

internal_sio = get_internal_sio()


@internal_sio.on("generate_text_complete")  # type: ignore
@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_attempt_grade_complete(data: dict[str, Any]) -> None:
    """Translate grade run_complete → attempt_progress(type=grade_complete)."""
    if data.get("event_type") != "run_complete":
        return
    artifact_type = data.get("artifact_type")
    if artifact_type not in ("chat", "attempt"):
        return
    metadata = data.get("metadata") or {}
    if not metadata.get("grade_id"):
        return
    await internal_sio.emit(
        "attempt_grade_complete",
        {
            "sid": data.get("sid", ""),
            "chat_id": metadata.get("chat_id", ""),
            "grade_id": metadata.get("grade_id", ""),
        },
    )
