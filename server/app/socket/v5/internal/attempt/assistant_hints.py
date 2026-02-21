"""Internal handler: generate_call_complete(tool_result) → attempt_progress(type=assistant_hints).

Fires when a tool result contains hints (entry_type == "hints").
"""

from typing import Any

from app.main import get_internal_sio
from app.socket.v5.internal.attempt.types import AttemptAssistantHintsData

internal_sio = get_internal_sio()


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_attempt_assistant_hints(data: dict[str, Any]) -> None:
    """Translate tool_result with hints → attempt_progress(type=assistant_hints)."""
    if data.get("event_type") != "tool_result":
        return
    artifact_type = data.get("artifact_type")
    if artifact_type not in ("chat", "attempt"):
        return
    entry_type = data.get("entry_type")
    if entry_type != "hints":
        return
    metadata = data.get("metadata") or {}
    result = data.get("result") or {}
    await internal_sio.emit(
        "attempt_assistant_hints",
        AttemptAssistantHintsData(
            sid=data.get("sid", ""),
            chat_id=metadata.get("chat_id", ""),
            hints=result.get("hints", []),
        ).model_dump(mode="json"),
    )
