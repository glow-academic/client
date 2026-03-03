"""Generic resource generation started handler."""

from typing import Any

from app.v5.infra.websocket.resolve_resource_type import resolve_resource_type
from app.v5.infra.globals import get_internal_sio, sio
from app.v5.registry.resource_events import RESOURCE_EVENTS

internal_sio = get_internal_sio()


@internal_sio.on("generate_call_start")  # type: ignore
async def resource_generation_started(data: dict[str, Any]) -> None:
    """Route tool_call_start to clients as {resource_type}_generation_started."""
    if data.get("event_type") != "tool_call_start":
        return
    resource_type = resolve_resource_type(data)
    if not resource_type or resource_type not in RESOURCE_EVENTS:
        return
    sid = data.get("sid", "")
    if not sid:
        return

    EventClass = RESOURCE_EVENTS[resource_type]
    event = EventClass(
        artifact_type=data.get("artifact_type", ""),
        group_id=data.get("group_id", ""),
        run_id=data.get("run_id"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
    )
    await sio.emit(
        f"{resource_type}_generation_started",
        event.model_dump(mode="json"),
        room=sid,
    )
