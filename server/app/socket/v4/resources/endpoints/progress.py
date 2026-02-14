"""Endpoints resource progress handler."""

from typing import Any

from app.main import sio
from app.socket.v4.resources.types import ResourceProgressEvent


async def handle_progress(data: dict[str, Any]) -> None:
    """Endpoints generation progress - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    event = ResourceProgressEvent(
        artifact_type=data.get("artifact_type", ""),
        resource_type="endpoints",
        group_id=data.get("group_id"),
        run_id=data.get("run_id"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
        arguments_delta=data.get("arguments_delta"),
        arguments=data.get("arguments"),
    )

    await sio.emit(
        "endpoints_generation_progress",
        event.model_dump(mode="json"),
        room=sid,
    )
