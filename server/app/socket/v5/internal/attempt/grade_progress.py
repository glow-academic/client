"""Internal handler: generate_call_complete(tool_result) → attempt_progress(type=grade_progress).

Fires on per-criterion grade results (tool_result with grade_id in metadata).
"""

from typing import Any

from app.main import get_internal_sio

internal_sio = get_internal_sio()


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_attempt_grade_progress(data: dict[str, Any]) -> None:
    """Translate grade tool_result → attempt_progress(type=grade_progress)."""
    if data.get("event_type") != "tool_result":
        return
    artifact_type = data.get("artifact_type")
    if artifact_type not in ("chat", "attempt"):
        return
    metadata = data.get("metadata") or {}
    if not metadata.get("grade_id"):
        return
    result = data.get("result") or {}
    await internal_sio.emit(
        "attempt_grade_progress",
        {
            "sid": data.get("sid", ""),
            "chat_id": metadata.get("chat_id", ""),
            "grade_id": metadata.get("grade_id", ""),
            "resource_type": data.get("resource_type", ""),
            "entry": result,
        },
    )
