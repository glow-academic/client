"""Agents resource error handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.resources.agents.types import AgentsGenerationErrorEvent
from app.socket.v4.resources.utils import resolve_resource_type

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_error(data: dict[str, Any]) -> None:
    """Agents generation error - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    event = AgentsGenerationErrorEvent(
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
        "agents_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_error")  # type: ignore
async def agents_call_error_listener(data: dict[str, Any]) -> None:
    """Listen for error events targeting agents."""
    if resolve_resource_type(data) != "agents":
        return
    await handle_error(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/agents_generation_error")
async def agents_generation_error_api(
    request: AgentsGenerationErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Agents generation error."""
    return {"success": True}
