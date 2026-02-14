"""Videos resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.videos.types import VideosGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/videos_generation_complete")
async def videos_generation_complete_api(
    request: VideosGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Videos generation completed."""
    return {"success": True}


@server_router.post("/videos_generation_started")
async def videos_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Videos generation started."""
    return {"success": True}


@server_router.post("/videos_generation_progress")
async def videos_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Videos generation progress."""
    return {"success": True}


@server_router.post("/videos_generation_error")
async def videos_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Videos generation error."""
    return {"success": True}
