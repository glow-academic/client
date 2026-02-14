"""Prompts resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.prompts.types import PromptsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/prompts_generation_complete")
async def prompts_generation_complete_api(
    request: PromptsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Prompts generation completed."""
    return {"success": True}


@server_router.post("/prompts_generation_started")
async def prompts_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Prompts generation started."""
    return {"success": True}


@server_router.post("/prompts_generation_progress")
async def prompts_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Prompts generation progress."""
    return {"success": True}


@server_router.post("/prompts_generation_error")
async def prompts_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Prompts generation error."""
    return {"success": True}
