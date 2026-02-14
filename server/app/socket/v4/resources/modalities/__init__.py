"""Modalities resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.modalities.types import ModalitiesGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/modalities_generation_complete")
async def modalities_generation_complete_api(
    request: ModalitiesGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Modalities generation completed."""
    return {"success": True}


@server_router.post("/modalities_generation_started")
async def modalities_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Modalities generation started."""
    return {"success": True}


@server_router.post("/modalities_generation_progress")
async def modalities_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Modalities generation progress."""
    return {"success": True}


@server_router.post("/modalities_generation_error")
async def modalities_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Modalities generation error."""
    return {"success": True}
