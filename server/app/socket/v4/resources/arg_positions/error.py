"""ArgPositions resource error handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.resources.arg_positions.types import ArgPositionsGenerationErrorEvent
from app.socket.v4.resources.utils import resolve_resource_type

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_error(data: dict[str, Any]) -> None:
    """ArgPositions generation error - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    event = ArgPositionsGenerationErrorEvent(
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
        "arg_positions_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_error")  # type: ignore
async def arg_positions_call_error_listener(data: dict[str, Any]) -> None:
    """Listen for error events targeting arg_positions."""
    if resolve_resource_type(data) != "arg_positions":
        return
    await handle_error(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/arg_positions_generation_error")
async def arg_positions_generation_error_api(
    request: ArgPositionsGenerationErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: ArgPositions generation error."""
    return {"success": True}
