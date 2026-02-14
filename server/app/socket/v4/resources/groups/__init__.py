"""Groups resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.groups.types import GroupsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/groups_generation_complete")
async def groups_generation_complete_api(
    request: GroupsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Groups generation completed."""
    return {"success": True}


@server_router.post("/groups_generation_started")
async def groups_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Groups generation started."""
    return {"success": True}


@server_router.post("/groups_generation_progress")
async def groups_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Groups generation progress."""
    return {"success": True}


@server_router.post("/groups_generation_error")
async def groups_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Groups generation error."""
    return {"success": True}
