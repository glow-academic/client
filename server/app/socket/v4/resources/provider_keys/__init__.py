"""ProviderKeys resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.provider_keys.types import ProviderKeysGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/provider_keys_generation_complete")
async def provider_keys_generation_complete_api(
    request: ProviderKeysGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: ProviderKeys generation completed."""
    return {"success": True}


@server_router.post("/provider_keys_generation_started")
async def provider_keys_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: ProviderKeys generation started."""
    return {"success": True}


@server_router.post("/provider_keys_generation_progress")
async def provider_keys_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: ProviderKeys generation progress."""
    return {"success": True}


@server_router.post("/provider_keys_generation_error")
async def provider_keys_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: ProviderKeys generation error."""
    return {"success": True}
