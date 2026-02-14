"""Keys resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.keys.types import KeysGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/keys_generation_complete")
async def keys_generation_complete_api(
    request: KeysGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Keys generation completed."""
    return {"success": True}


@server_router.post("/keys_generation_started")
async def keys_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Keys generation started."""
    return {"success": True}


@server_router.post("/keys_generation_progress")
async def keys_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Keys generation progress."""
    return {"success": True}


@server_router.post("/keys_generation_error")
async def keys_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Keys generation error."""
    return {"success": True}
