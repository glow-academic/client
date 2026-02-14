"""ScenarioPersonas resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.scenario_personas.types import ScenarioPersonasGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/scenario_personas_generation_complete")
async def scenario_personas_generation_complete_api(
    request: ScenarioPersonasGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: ScenarioPersonas generation completed."""
    return {"success": True}


@server_router.post("/scenario_personas_generation_started")
async def scenario_personas_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: ScenarioPersonas generation started."""
    return {"success": True}


@server_router.post("/scenario_personas_generation_progress")
async def scenario_personas_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: ScenarioPersonas generation progress."""
    return {"success": True}


@server_router.post("/scenario_personas_generation_error")
async def scenario_personas_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: ScenarioPersonas generation error."""
    return {"success": True}
