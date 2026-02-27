"""Generic entry generation complete handler."""

from typing import Any

from app.infra.v4.websocket.resolve_entry_type import resolve_entry_type
from app.main import get_internal_sio, sio
from app.registry.entry_events import ENTRY_EVENTS

internal_sio = get_internal_sio()


@internal_sio.on("generate_call_complete")  # type: ignore
async def entry_generation_complete(data: dict[str, Any]) -> None:
    """Route tool_result to clients as {entry_type}_generation_complete."""
    if data.get("event_type") != "tool_result":
        return
    entry_type = resolve_entry_type(data)
    if not entry_type or entry_type not in ENTRY_EVENTS:
        return
    sid = data.get("sid", "")
    if not sid:
        return

    EventClass = ENTRY_EVENTS[entry_type]
    tool_result = data.get("result") or {}
    entry_data = tool_result.get("entry_data") or {}

    event = EventClass(
        artifact_type=data.get("artifact_type", ""),
        entry_id=tool_result.get("entry_id"),
        group_id=data.get("group_id", ""),
        run_id=data.get("run_id"),
        success=True,
        **entry_data,
    )
    await sio.emit(
        f"{entry_type}_generation_complete",
        event.model_dump(mode="json"),
        room=sid,
    )
