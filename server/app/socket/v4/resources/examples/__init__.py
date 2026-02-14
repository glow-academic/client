"""Examples resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.examples.types import ExamplesGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/examples_generation_complete")
async def examples_generation_complete_api(
    request: ExamplesGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Examples generation completed."""
    return {"success": True}


@server_router.post("/examples_generation_started")
async def examples_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Examples generation started."""
    return {"success": True}


@server_router.post("/examples_generation_progress")
async def examples_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Examples generation progress."""
    return {"success": True}


@server_router.post("/examples_generation_error")
async def examples_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Examples generation error."""
    return {"success": True}
