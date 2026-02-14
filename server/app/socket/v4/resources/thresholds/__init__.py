"""Thresholds resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.thresholds.types import ThresholdsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/thresholds_generation_complete")
async def thresholds_generation_complete_api(
    request: ThresholdsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Thresholds generation completed."""
    return {"success": True}


@server_router.post("/thresholds_generation_started")
async def thresholds_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Thresholds generation started."""
    return {"success": True}


@server_router.post("/thresholds_generation_progress")
async def thresholds_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Thresholds generation progress."""
    return {"success": True}


@server_router.post("/thresholds_generation_error")
async def thresholds_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Thresholds generation error."""
    return {"success": True}
