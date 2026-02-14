"""Slugs resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.slugs.types import SlugsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/slugs_generation_complete")
async def slugs_generation_complete_api(
    request: SlugsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Slugs generation completed."""
    return {"success": True}


@server_router.post("/slugs_generation_started")
async def slugs_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Slugs generation started."""
    return {"success": True}


@server_router.post("/slugs_generation_progress")
async def slugs_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Slugs generation progress."""
    return {"success": True}


@server_router.post("/slugs_generation_error")
async def slugs_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Slugs generation error."""
    return {"success": True}
