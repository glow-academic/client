"""Names resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.names.types import NamesGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/names_generation_complete")
async def names_generation_complete_api(
    request: NamesGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Names generation completed."""
    return {"success": True}


@server_router.post("/names_generation_started")
async def names_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Names generation started."""
    return {"success": True}


@server_router.post("/names_generation_progress")
async def names_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Names generation progress."""
    return {"success": True}


@server_router.post("/names_generation_error")
async def names_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Names generation error."""
    return {"success": True}
