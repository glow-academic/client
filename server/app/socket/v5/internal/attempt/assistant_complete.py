"""Internal handler: generate_text_complete/generate_call_complete → attempt_progress(type=assistant_complete).

Fires on run_complete for attempt-related artifacts when there is no grade_id
(i.e. assistant message generation, not grading).
"""

from typing import Any

from app.main import get_internal_sio

internal_sio = get_internal_sio()


@internal_sio.on("generate_text_complete")  # type: ignore
@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_attempt_assistant_complete(data: dict[str, Any]) -> None:
    """Translate run_complete → attempt_progress(type=assistant_complete)."""
    if data.get("event_type") != "run_complete":
        return
    artifact_type = data.get("artifact_type")
    if artifact_type not in ("chat", "attempt"):
        return
    metadata = data.get("metadata") or {}
    if metadata.get("grade_id"):
        return  # Grade completion, not assistant
    await internal_sio.emit(
        "attempt_assistant_complete",
        {
            "sid": data.get("sid", ""),
            "chat_id": metadata.get("chat_id", ""),
            "message_id": "",
            "content": data.get("assistant_output", ""),
        },
    )
