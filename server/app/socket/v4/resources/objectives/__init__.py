"""Objectives resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.objectives.types import ObjectivesGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/objectives_generation_complete")
async def objectives_generation_complete_api(
    request: ObjectivesGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Objectives generation completed."""
    return {"success": True}


@server_router.post("/objectives_generation_started")
async def objectives_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Objectives generation started."""
    return {"success": True}


@server_router.post("/objectives_generation_progress")
async def objectives_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Objectives generation progress."""
    return {"success": True}


@server_router.post("/objectives_generation_error")
async def objectives_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Objectives generation error."""
    return {"success": True}
