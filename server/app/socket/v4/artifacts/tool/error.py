"""Tool error handler - emits tool-specific generation error events."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.tool.types import ToolGenerationErrorEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_error")  # type: ignore
async def handle_tool_generation_error(data: dict[str, Any]) -> None:
    artifact_type = data.get("artifact_type")
    if artifact_type != "tool":
        return

    sid = data.get("sid")
    if not sid:
        return

    event = ToolGenerationErrorEvent(
        artifact_type="tool",
        resource_type=data.get("resource_type"),
        group_id=data.get("group_id"),
        message=data.get("error_message") or data.get("message") or "Generation failed",
        success=False,
    )

    await sio.emit(
        "tool_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )


@server_router.post("/tool_generation_error")
async def tool_generation_error_api(
    request: ToolGenerationErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Tool generation error.

    Emitted when tool resource generation fails.
    """
    return {"success": True}
