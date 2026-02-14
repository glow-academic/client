"""TemperatureLevels resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.temperature_levels.types import TemperatureLevelsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/temperature_levels_generation_complete")
async def temperature_levels_generation_complete_api(
    request: TemperatureLevelsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: TemperatureLevels generation completed."""
    return {"success": True}


@server_router.post("/temperature_levels_generation_started")
async def temperature_levels_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: TemperatureLevels generation started."""
    return {"success": True}


@server_router.post("/temperature_levels_generation_progress")
async def temperature_levels_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: TemperatureLevels generation progress."""
    return {"success": True}


@server_router.post("/temperature_levels_generation_error")
async def temperature_levels_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: TemperatureLevels generation error."""
    return {"success": True}
