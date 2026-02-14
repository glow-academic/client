"""Endpoints resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.endpoints.types import EndpointsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/endpoints_generation_complete")
async def endpoints_generation_complete_api(
    request: EndpointsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Endpoints generation completed."""
    return {"success": True}


@server_router.post("/endpoints_generation_started")
async def endpoints_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Endpoints generation started."""
    return {"success": True}


@server_router.post("/endpoints_generation_progress")
async def endpoints_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Endpoints generation progress."""
    return {"success": True}


@server_router.post("/endpoints_generation_error")
async def endpoints_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Endpoints generation error."""
    return {"success": True}
