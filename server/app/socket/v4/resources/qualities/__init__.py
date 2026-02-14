"""Qualities resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.qualities.types import QualitiesGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/qualities_generation_complete")
async def qualities_generation_complete_api(
    request: QualitiesGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Qualities generation completed."""
    return {"success": True}


@server_router.post("/qualities_generation_started")
async def qualities_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Qualities generation started."""
    return {"success": True}


@server_router.post("/qualities_generation_progress")
async def qualities_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Qualities generation progress."""
    return {"success": True}


@server_router.post("/qualities_generation_error")
async def qualities_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Qualities generation error."""
    return {"success": True}
