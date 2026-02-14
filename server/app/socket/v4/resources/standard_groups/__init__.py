"""StandardGroups resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.standard_groups.types import StandardGroupsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/standard_groups_generation_complete")
async def standard_groups_generation_complete_api(
    request: StandardGroupsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: StandardGroups generation completed."""
    return {"success": True}


@server_router.post("/standard_groups_generation_started")
async def standard_groups_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: StandardGroups generation started."""
    return {"success": True}


@server_router.post("/standard_groups_generation_progress")
async def standard_groups_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: StandardGroups generation progress."""
    return {"success": True}


@server_router.post("/standard_groups_generation_error")
async def standard_groups_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: StandardGroups generation error."""
    return {"success": True}
