"""Generic entry generation error handler."""

from typing import Any

from app.v5.infra.websocket.resolve_entry_type import resolve_entry_type
from app.main import get_internal_sio, sio
from app.v5.registry.entry_events import ENTRY_EVENTS

internal_sio = get_internal_sio()


@internal_sio.on("generate_call_error")  # type: ignore
async def entry_generation_error(data: dict[str, Any]) -> None:
    """Route generation errors to clients as {entry_type}_generation_error."""
    entry_type = resolve_entry_type(data)
    if not entry_type or entry_type not in ENTRY_EVENTS:
        return
    sid = data.get("sid", "")
    if not sid:
        return

    EventClass = ENTRY_EVENTS[entry_type]
    resolved_fields = data.get("resolved_fields") or {}

    event = EventClass(
        artifact_type=data.get("artifact_type", ""),
        group_id=data.get("group_id", ""),
        run_id=data.get("run_id"),
        success=False,
        message=data.get("message", "An error occurred during generation"),
        error_stage=data.get("error_stage"),
        **resolved_fields,
    )
    await sio.emit(
        f"{entry_type}_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )
