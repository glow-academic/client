"""Voices resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.voices.types import VoicesGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/voices_generation_complete")
async def voices_generation_complete_api(
    request: VoicesGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Voices generation completed."""
    return {"success": True}


@server_router.post("/voices_generation_started")
async def voices_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Voices generation started."""
    return {"success": True}


@server_router.post("/voices_generation_progress")
async def voices_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Voices generation progress."""
    return {"success": True}


@server_router.post("/voices_generation_error")
async def voices_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Voices generation error."""
    return {"success": True}
