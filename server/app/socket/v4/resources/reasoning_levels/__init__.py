"""ReasoningLevels resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.reasoning_levels.types import ReasoningLevelsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/reasoning_levels_generation_complete")
async def reasoning_levels_generation_complete_api(
    request: ReasoningLevelsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: ReasoningLevels generation completed."""
    return {"success": True}


@server_router.post("/reasoning_levels_generation_started")
async def reasoning_levels_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: ReasoningLevels generation started."""
    return {"success": True}


@server_router.post("/reasoning_levels_generation_progress")
async def reasoning_levels_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: ReasoningLevels generation progress."""
    return {"success": True}


@server_router.post("/reasoning_levels_generation_error")
async def reasoning_levels_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: ReasoningLevels generation error."""
    return {"success": True}
