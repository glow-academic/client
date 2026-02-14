"""RequestLimits resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.request_limits.types import RequestLimitsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/request_limits_generation_complete")
async def request_limits_generation_complete_api(
    request: RequestLimitsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: RequestLimits generation completed."""
    return {"success": True}


@server_router.post("/request_limits_generation_started")
async def request_limits_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: RequestLimits generation started."""
    return {"success": True}


@server_router.post("/request_limits_generation_progress")
async def request_limits_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: RequestLimits generation progress."""
    return {"success": True}


@server_router.post("/request_limits_generation_error")
async def request_limits_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: RequestLimits generation error."""
    return {"success": True}
