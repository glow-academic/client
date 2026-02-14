"""ScenarioPositions resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.scenario_positions.types import ScenarioPositionsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/scenario_positions_generation_complete")
async def scenario_positions_generation_complete_api(
    request: ScenarioPositionsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: ScenarioPositions generation completed."""
    return {"success": True}


@server_router.post("/scenario_positions_generation_started")
async def scenario_positions_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: ScenarioPositions generation started."""
    return {"success": True}


@server_router.post("/scenario_positions_generation_progress")
async def scenario_positions_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: ScenarioPositions generation progress."""
    return {"success": True}


@server_router.post("/scenario_positions_generation_error")
async def scenario_positions_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: ScenarioPositions generation error."""
    return {"success": True}
