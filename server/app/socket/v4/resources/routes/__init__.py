"""Routes resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.routes.types import RoutesGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/routes_generation_complete")
async def routes_generation_complete_api(
    request: RoutesGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Routes generation completed."""
    return {"success": True}


@server_router.post("/routes_generation_started")
async def routes_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Routes generation started."""
    return {"success": True}


@server_router.post("/routes_generation_progress")
async def routes_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Routes generation progress."""
    return {"success": True}


@server_router.post("/routes_generation_error")
async def routes_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Routes generation error."""
    return {"success": True}
