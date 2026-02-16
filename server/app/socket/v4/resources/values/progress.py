"""Values resource progress handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.resources.utils import resolve_resource_type
from app.socket.v4.resources.values.types import ValuesGenerationEvent

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_progress(data: dict[str, Any]) -> None:
    """Values generation progress - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    resolved_fields = data.get("resolved_fields") or {}

    event = ValuesGenerationEvent(
        artifact_type=data.get("artifact_type", ""),
        group_id=data.get("group_id"),
        run_id=data.get("run_id"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
        arguments_delta=data.get("arguments_delta"),
        **resolved_fields,
    )

    await sio.emit(
        "values_generation_progress",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_progress")  # type: ignore
async def values_call_progress_listener(data: dict[str, Any]) -> None:
    """Listen for tool_call_delta events targeting values."""
    if data.get("event_type") != "tool_call_delta":
        return
    if resolve_resource_type(data) != "values":
        return
    await handle_progress(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/values_generation_progress")
async def values_generation_progress_api(
    request: ValuesGenerationEvent,
) -> dict[str, bool]:
    """Server-to-client event: Values generation progress."""
    return {"success": True}
