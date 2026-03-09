"""Scenario export endpoint — composable infra architecture."""

from fastapi import APIRouter, Request, Response

from app.infra.globals import get_pool, get_redis_client
from app.infra.scenario_export import export_scenario_client
from app.routes.v5.api.main.scenario.types import (
    ExportScenarioApiRequest,
    ExportScenarioApiResponse,
)

router = APIRouter()


@router.post("/export", response_model=ExportScenarioApiResponse)
async def export_scenarios(
    body: ExportScenarioApiRequest,
    http_request: Request,
    response: Response,
) -> ExportScenarioApiResponse:
    """Export all scenarios as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id
    pool = get_pool()
    redis = get_redis_client()

    return await export_scenario_client(
        pool,
        redis,
        profile_id=profile_id,
        session_id=session_id,
        scenario_id=body.scenario_id,
    )
