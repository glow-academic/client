"""Values resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.values.types import ValuesGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/values_generation_complete")
async def values_generation_complete_api(
    request: ValuesGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Values generation completed."""
    return {"success": True}


@server_router.post("/values_generation_started")
async def values_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Values generation started."""
    return {"success": True}


@server_router.post("/values_generation_progress")
async def values_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Values generation progress."""
    return {"success": True}


@server_router.post("/values_generation_error")
async def values_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Values generation error."""
    return {"success": True}
