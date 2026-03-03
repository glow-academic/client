"""Generic entry generation progress handler."""

from typing import Any

from app.infra.globals import get_internal_sio, sio
from app.infra.websocket.resolve_entry_type import resolve_entry_type
from app.registry.entry_events import ENTRY_EVENTS

internal_sio = get_internal_sio()


@internal_sio.on("generate_call_progress")  # type: ignore
async def entry_generation_progress(data: dict[str, Any]) -> None:
    """Route tool_call_delta to clients as {entry_type}_generation_progress."""
    if data.get("event_type") != "tool_call_delta":
        return
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
        arguments_delta=data.get("arguments_delta"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
        **resolved_fields,
    )
    await sio.emit(
        f"{entry_type}_generation_progress",
        event.model_dump(mode="json"),
        room=sid,
    )
