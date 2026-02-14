"""SimulationPositions resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.simulation_positions.types import SimulationPositionsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/simulation_positions_generation_complete")
async def simulation_positions_generation_complete_api(
    request: SimulationPositionsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: SimulationPositions generation completed."""
    return {"success": True}


@server_router.post("/simulation_positions_generation_started")
async def simulation_positions_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: SimulationPositions generation started."""
    return {"success": True}


@server_router.post("/simulation_positions_generation_progress")
async def simulation_positions_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: SimulationPositions generation progress."""
    return {"success": True}


@server_router.post("/simulation_positions_generation_error")
async def simulation_positions_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: SimulationPositions generation error."""
    return {"success": True}
