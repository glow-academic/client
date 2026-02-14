"""Options resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.options.types import OptionsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/options_generation_complete")
async def options_generation_complete_api(
    request: OptionsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Options generation completed."""
    return {"success": True}


@server_router.post("/options_generation_started")
async def options_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Options generation started."""
    return {"success": True}


@server_router.post("/options_generation_progress")
async def options_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Options generation progress."""
    return {"success": True}


@server_router.post("/options_generation_error")
async def options_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Options generation error."""
    return {"success": True}
