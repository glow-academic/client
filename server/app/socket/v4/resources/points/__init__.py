"""Points resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.points.types import PointsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/points_generation_complete")
async def points_generation_complete_api(
    request: PointsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Points generation completed."""
    return {"success": True}


@server_router.post("/points_generation_started")
async def points_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Points generation started."""
    return {"success": True}


@server_router.post("/points_generation_progress")
async def points_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Points generation progress."""
    return {"success": True}


@server_router.post("/points_generation_error")
async def points_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Points generation error."""
    return {"success": True}
