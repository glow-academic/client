"""Providers resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.providers.types import ProvidersGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/providers_generation_complete")
async def providers_generation_complete_api(
    request: ProvidersGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Providers generation completed."""
    return {"success": True}


@server_router.post("/providers_generation_started")
async def providers_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Providers generation started."""
    return {"success": True}


@server_router.post("/providers_generation_progress")
async def providers_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Providers generation progress."""
    return {"success": True}


@server_router.post("/providers_generation_error")
async def providers_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Providers generation error."""
    return {"success": True}
