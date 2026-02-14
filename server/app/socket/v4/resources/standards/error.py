"""Standards resource error handler."""

from typing import Any

from app.main import sio
from app.socket.v4.resources.types import ResourceErrorEvent


async def handle_error(data: dict[str, Any]) -> None:
    """Standards generation error - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    event = ResourceErrorEvent(
        artifact_type=data.get("artifact_type", ""),
        resource_type="standards",
        group_id=data.get("group_id"),
        run_id=data.get("run_id"),
        success=False,
        message=data.get("message") or data.get("error_message") or "Unknown error",
        error_stage=data.get("error_stage"),
        tool_name=data.get("tool_name"),
        tool_call_id=data.get("tool_call_id"),
        arguments=data.get("arguments"),
    )

    await sio.emit(
        "standards_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )
