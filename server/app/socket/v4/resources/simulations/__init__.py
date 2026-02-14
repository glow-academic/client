"""Simulations resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.simulations.types import SimulationsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/simulations_generation_complete")
async def simulations_generation_complete_api(
    request: SimulationsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Simulations generation completed."""
    return {"success": True}


@server_router.post("/simulations_generation_started")
async def simulations_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Simulations generation started."""
    return {"success": True}


@server_router.post("/simulations_generation_progress")
async def simulations_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Simulations generation progress."""
    return {"success": True}


@server_router.post("/simulations_generation_error")
async def simulations_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Simulations generation error."""
    return {"success": True}
