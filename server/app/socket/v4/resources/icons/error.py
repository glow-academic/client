"""Icons resource error handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.resources.icons.types import IconsGenerationErrorEvent
from app.socket.v4.resources.utils import resolve_resource_type

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_error(data: dict[str, Any]) -> None:
    """Icons generation error - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    event = IconsGenerationErrorEvent(
        artifact_type=data.get("artifact_type", ""),
        group_id=data.get("group_id"),
        run_id=data.get("run_id"),
        message=data.get("message") or data.get("error_message") or "Unknown error",
        error_stage=data.get("error_stage"),
        tool_name=data.get("tool_name"),
        tool_call_id=data.get("tool_call_id"),
        arguments=data.get("arguments"),
    )

    await sio.emit(
        "icons_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_error")  # type: ignore
async def icons_call_error_listener(data: dict[str, Any]) -> None:
    """Listen for error events targeting icons."""
    if resolve_resource_type(data) != "icons":
        return
    await handle_error(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/icons_generation_error")
async def icons_generation_error_api(
    request: IconsGenerationErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Icons generation error."""
    return {"success": True}
