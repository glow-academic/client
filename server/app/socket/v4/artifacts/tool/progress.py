"""Tool progress handler - emits tool-specific generation progress events."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.tool.types import ToolGenerationProgressEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_start")  # type: ignore
@internal_sio.on("generate_call_progress")  # type: ignore
async def handle_tool_call_progress(data: dict[str, Any]) -> None:
    artifact_type = data.get("artifact_type")
    if artifact_type != "tool":
        return

    sid = data.get("sid")
    if not sid:
        return

    event = ToolGenerationProgressEvent(
        artifact_type="tool",
        resource_type=data.get("resource_type"),
        resource_id=data.get("resource_id"),
        run_id=data.get("run_id"),
        group_id=data.get("group_id"),
        event_type=data.get("event_type"),
        type=data.get("type", "progress"),
        trace_id=data.get("trace_id"),
    )

    await sio.emit(
        "tool_generation_progress",
        event.model_dump(mode="json"),
        room=sid,
    )


@server_router.post("/tool_generation_progress")
async def tool_generation_progress_api(
    request: ToolGenerationProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Tool generation progress.

    Emitted during tool resource generation to show progress.
    """
    return {"success": True}
