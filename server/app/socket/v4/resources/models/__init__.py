"""Models resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.models.types import ModelsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/models_generation_complete")
async def models_generation_complete_api(
    request: ModelsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Models generation completed."""
    return {"success": True}


@server_router.post("/models_generation_started")
async def models_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Models generation started."""
    return {"success": True}


@server_router.post("/models_generation_progress")
async def models_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Models generation progress."""
    return {"success": True}


@server_router.post("/models_generation_error")
async def models_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Models generation error."""
    return {"success": True}
