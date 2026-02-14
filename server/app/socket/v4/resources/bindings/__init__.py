"""Bindings resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.bindings.types import BindingsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/bindings_generation_complete")
async def bindings_generation_complete_api(
    request: BindingsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Bindings generation completed."""
    return {"success": True}


@server_router.post("/bindings_generation_started")
async def bindings_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Bindings generation started."""
    return {"success": True}


@server_router.post("/bindings_generation_progress")
async def bindings_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Bindings generation progress."""
    return {"success": True}


@server_router.post("/bindings_generation_error")
async def bindings_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Bindings generation error."""
    return {"success": True}
