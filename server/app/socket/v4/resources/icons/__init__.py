"""Icons resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.icons.types import IconsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/icons_generation_complete")
async def icons_generation_complete_api(
    request: IconsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Icons generation completed."""
    return {"success": True}


@server_router.post("/icons_generation_started")
async def icons_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Icons generation started."""
    return {"success": True}


@server_router.post("/icons_generation_progress")
async def icons_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Icons generation progress."""
    return {"success": True}


@server_router.post("/icons_generation_error")
async def icons_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Icons generation error."""
    return {"success": True}
