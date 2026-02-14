"""Cohorts resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.cohorts.types import CohortsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/cohorts_generation_complete")
async def cohorts_generation_complete_api(
    request: CohortsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Cohorts generation completed."""
    return {"success": True}


@server_router.post("/cohorts_generation_started")
async def cohorts_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Cohorts generation started."""
    return {"success": True}


@server_router.post("/cohorts_generation_progress")
async def cohorts_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Cohorts generation progress."""
    return {"success": True}


@server_router.post("/cohorts_generation_error")
async def cohorts_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Cohorts generation error."""
    return {"success": True}
