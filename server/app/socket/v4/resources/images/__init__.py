"""Images resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.images.types import ImagesGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/images_generation_complete")
async def images_generation_complete_api(
    request: ImagesGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Images generation completed."""
    return {"success": True}


@server_router.post("/images_generation_started")
async def images_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Images generation started."""
    return {"success": True}


@server_router.post("/images_generation_progress")
async def images_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Images generation progress."""
    return {"success": True}


@server_router.post("/images_generation_error")
async def images_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Images generation error."""
    return {"success": True}
