"""GroupPositions resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.group_positions.types import GroupPositionsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/group_positions_generation_complete")
async def group_positions_generation_complete_api(
    request: GroupPositionsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: GroupPositions generation completed."""
    return {"success": True}


@server_router.post("/group_positions_generation_started")
async def group_positions_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: GroupPositions generation started."""
    return {"success": True}


@server_router.post("/group_positions_generation_progress")
async def group_positions_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: GroupPositions generation progress."""
    return {"success": True}


@server_router.post("/group_positions_generation_error")
async def group_positions_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: GroupPositions generation error."""
    return {"success": True}
