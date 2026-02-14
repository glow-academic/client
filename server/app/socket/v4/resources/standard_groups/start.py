"""StandardGroups resource start handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.resources.standard_groups.types import (
    StandardGroupsGenerationStartedEvent,
)
from app.socket.v4.resources.utils import resolve_resource_type

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_start(data: dict[str, Any]) -> None:
    """StandardGroups generation started - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    event = StandardGroupsGenerationStartedEvent(
        artifact_type=data.get("artifact_type", ""),
        group_id=data.get("group_id", ""),
        run_id=data.get("run_id"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
    )

    await sio.emit(
        "standard_groups_generation_started",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_start")  # type: ignore
async def standard_groups_call_start_listener(data: dict[str, Any]) -> None:
    """Listen for tool_call_start events targeting standard_groups."""
    if data.get("event_type") != "tool_call_start":
        return
    if resolve_resource_type(data) != "standard_groups":
        return
    await handle_start(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/standard_groups_generation_started")
async def standard_groups_generation_started_api(
    request: StandardGroupsGenerationStartedEvent,
) -> dict[str, bool]:
    """Server-to-client event: StandardGroups generation started."""
    return {"success": True}
