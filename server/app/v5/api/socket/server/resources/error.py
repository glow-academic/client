"""Generic resource generation error handler."""

from typing import Any

from app.infra.websocket.resolve_resource_type import resolve_resource_type
from app.globals import get_internal_sio, sio
from app.registry.resource_events import RESOURCE_EVENTS

internal_sio = get_internal_sio()


@internal_sio.on("generate_call_error")  # type: ignore
async def resource_generation_error(data: dict[str, Any]) -> None:
    """Route generation errors to clients as {resource_type}_generation_error."""
    resource_type = resolve_resource_type(data)
    if not resource_type or resource_type not in RESOURCE_EVENTS:
        return
    sid = data.get("sid", "")
    if not sid:
        return

    EventClass = RESOURCE_EVENTS[resource_type]
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
        f"{resource_type}_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )
