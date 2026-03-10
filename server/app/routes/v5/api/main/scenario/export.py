"""Scenario export endpoint — composable infra architecture."""

from fastapi import APIRouter, Request, Response

from app.infra.events.audit import run_artifact_operation_with_audit
from app.infra.globals import get_pool, get_redis_client, get_upload_folder
from app.infra.scenario.export import export_scenario_impl
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

    async def _runner() -> ExportScenarioApiResponse:
        return await export_scenario_impl(
            pool,
            redis,
            profile_id=profile_id,
            session_id=session_id,
            scenario_id=body.scenario_id,
        )

    return await run_artifact_operation_with_audit(
        pool,
        redis,
        artifact="scenario",
        profile_id=profile_id,
        session_id=session_id,
        operation="export",
        arguments=body.model_dump(mode="json"),
        response_model=ExportScenarioApiResponse,
        runner=_runner,
        upload_folder=get_upload_folder(),
    )
