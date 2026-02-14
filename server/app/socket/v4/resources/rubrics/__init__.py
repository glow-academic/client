"""Rubrics resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.rubrics.types import RubricsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/rubrics_generation_complete")
async def rubrics_generation_complete_api(
    request: RubricsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Rubrics generation completed."""
    return {"success": True}


@server_router.post("/rubrics_generation_started")
async def rubrics_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Rubrics generation started."""
    return {"success": True}


@server_router.post("/rubrics_generation_progress")
async def rubrics_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Rubrics generation progress."""
    return {"success": True}


@server_router.post("/rubrics_generation_error")
async def rubrics_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Rubrics generation error."""
    return {"success": True}
