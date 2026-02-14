"""Voices resource progress handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.resources.utils import resolve_resource_type
from app.socket.v4.resources.voices.types import VoicesGenerationProgressEvent

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_progress(data: dict[str, Any]) -> None:
    """Voices generation progress - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    event = VoicesGenerationProgressEvent(
        artifact_type=data.get("artifact_type", ""),
        group_id=data.get("group_id"),
        run_id=data.get("run_id"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
        arguments_delta=data.get("arguments_delta"),
        arguments=data.get("arguments"),
    )

    await sio.emit(
        "voices_generation_progress",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_progress")  # type: ignore
async def voices_call_progress_listener(data: dict[str, Any]) -> None:
    """Listen for tool_call_delta events targeting voices."""
    if data.get("event_type") != "tool_call_delta":
        return
    if resolve_resource_type(data) != "voices":
        return
    await handle_progress(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/voices_generation_progress")
async def voices_generation_progress_api(
    request: VoicesGenerationProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Voices generation progress."""
    return {"success": True}
