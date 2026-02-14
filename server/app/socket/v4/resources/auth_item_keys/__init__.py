"""AuthItemKeys resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.auth_item_keys.types import AuthItemKeysGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/auth_item_keys_generation_complete")
async def auth_item_keys_generation_complete_api(
    request: AuthItemKeysGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: AuthItemKeys generation completed."""
    return {"success": True}


@server_router.post("/auth_item_keys_generation_started")
async def auth_item_keys_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: AuthItemKeys generation started."""
    return {"success": True}


@server_router.post("/auth_item_keys_generation_progress")
async def auth_item_keys_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: AuthItemKeys generation progress."""
    return {"success": True}


@server_router.post("/auth_item_keys_generation_error")
async def auth_item_keys_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: AuthItemKeys generation error."""
    return {"success": True}
