"""Colors resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.colors.types import ColorsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/colors_generation_complete")
async def colors_generation_complete_api(
    request: ColorsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Colors generation completed."""
    return {"success": True}


@server_router.post("/colors_generation_started")
async def colors_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Colors generation started."""
    return {"success": True}


@server_router.post("/colors_generation_progress")
async def colors_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Colors generation progress."""
    return {"success": True}


@server_router.post("/colors_generation_error")
async def colors_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Colors generation error."""
    return {"success": True}
