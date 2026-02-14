"""Texts resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.texts.types import TextsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/texts_generation_complete")
async def texts_generation_complete_api(
    request: TextsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Texts generation completed."""
    return {"success": True}


@server_router.post("/texts_generation_started")
async def texts_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Texts generation started."""
    return {"success": True}


@server_router.post("/texts_generation_progress")
async def texts_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Texts generation progress."""
    return {"success": True}


@server_router.post("/texts_generation_error")
async def texts_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Texts generation error."""
    return {"success": True}
