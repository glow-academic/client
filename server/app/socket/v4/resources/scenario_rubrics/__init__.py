"""ScenarioRubrics resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.scenario_rubrics.types import ScenarioRubricsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/scenario_rubrics_generation_complete")
async def scenario_rubrics_generation_complete_api(
    request: ScenarioRubricsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: ScenarioRubrics generation completed."""
    return {"success": True}


@server_router.post("/scenario_rubrics_generation_started")
async def scenario_rubrics_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: ScenarioRubrics generation started."""
    return {"success": True}


@server_router.post("/scenario_rubrics_generation_progress")
async def scenario_rubrics_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: ScenarioRubrics generation progress."""
    return {"success": True}


@server_router.post("/scenario_rubrics_generation_error")
async def scenario_rubrics_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: ScenarioRubrics generation error."""
    return {"success": True}
