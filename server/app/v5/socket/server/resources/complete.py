"""Generic resource generation complete handler."""

from typing import Any

from app.v5.infra.websocket.resolve_resource_type import resolve_resource_type
from app.main import get_internal_sio, sio
from app.v5.registry.resource_events import RESOURCE_EVENTS

internal_sio = get_internal_sio()


@internal_sio.on("generate_call_complete")  # type: ignore
async def resource_generation_complete(data: dict[str, Any]) -> None:
    """Route tool_result to clients as {resource_type}_generation_complete."""
    if data.get("event_type") != "tool_result":
        return
    resource_type = resolve_resource_type(data)
    if not resource_type or resource_type not in RESOURCE_EVENTS:
        return
    sid = data.get("sid", "")
    if not sid:
        return

    EventClass = RESOURCE_EVENTS[resource_type]
    tool_result = data.get("result") or {}
    resource_data = tool_result.get("resource_data") or {}

    event = EventClass(
        artifact_type=data.get("artifact_type", ""),
        resource_id=tool_result.get("resource_id"),
        group_id=data.get("group_id", ""),
        run_id=data.get("run_id"),
        success=True,
        **resource_data,
    )
    await sio.emit(
        f"{resource_type}_generation_complete",
        event.model_dump(mode="json"),
        room=sid,
    )
