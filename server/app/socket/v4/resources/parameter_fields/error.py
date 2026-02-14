"""ParameterFields resource error handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.resources.parameter_fields.types import ParameterFieldsGenerationErrorEvent
from app.socket.v4.resources.utils import resolve_resource_type

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_error(data: dict[str, Any]) -> None:
    """ParameterFields generation error - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    event = ParameterFieldsGenerationErrorEvent(
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
        "parameter_fields_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_error")  # type: ignore
async def parameter_fields_call_error_listener(data: dict[str, Any]) -> None:
    """Listen for error events targeting parameter_fields."""
    if resolve_resource_type(data) != "parameter_fields":
        return
    await handle_error(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/parameter_fields_generation_error")
async def parameter_fields_generation_error_api(
    request: ParameterFieldsGenerationErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: ParameterFields generation error."""
    return {"success": True}
