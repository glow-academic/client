"""Standards resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.standards.types import StandardsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/standards_generation_complete")
async def standards_generation_complete_api(
    request: StandardsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Standards generation completed."""
    return {"success": True}


@server_router.post("/standards_generation_started")
async def standards_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Standards generation started."""
    return {"success": True}


@server_router.post("/standards_generation_progress")
async def standards_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Standards generation progress."""
    return {"success": True}


@server_router.post("/standards_generation_error")
async def standards_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Standards generation error."""
    return {"success": True}
