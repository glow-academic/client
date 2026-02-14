"""Scenarios resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.scenarios.types import ScenariosGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/scenarios_generation_complete")
async def scenarios_generation_complete_api(
    request: ScenariosGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Scenarios generation completed."""
    return {"success": True}


@server_router.post("/scenarios_generation_started")
async def scenarios_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Scenarios generation started."""
    return {"success": True}


@server_router.post("/scenarios_generation_progress")
async def scenarios_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Scenarios generation progress."""
    return {"success": True}


@server_router.post("/scenarios_generation_error")
async def scenarios_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Scenarios generation error."""
    return {"success": True}
