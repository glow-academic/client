"""Simulation export endpoint — composable infra architecture."""

from fastapi import APIRouter, Request, Response

from app.infra.events.audit import run_artifact_operation_with_audit
from app.infra.globals import get_pool, get_redis_client, get_upload_folder
from app.infra.simulation.export import export_simulation_impl
from app.routes.v5.api.main.simulation.types import (
    ExportSimulationApiRequest,
    ExportSimulationApiResponse,
)

router = APIRouter()


@router.post("/export", response_model=ExportSimulationApiResponse)
async def export_simulations(
    body: ExportSimulationApiRequest,
    http_request: Request,
    response: Response,
) -> ExportSimulationApiResponse:
    """Export all simulations as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id
    pool = get_pool()
    redis = get_redis_client()

    async def _runner() -> ExportSimulationApiResponse:
        return await export_simulation_impl(
            pool,
            redis,
            profile_id=profile_id,
            session_id=session_id,
            simulation_id=body.simulation_id,
        )

    return await run_artifact_operation_with_audit(
        pool,
        redis,
        artifact="simulation",
        profile_id=profile_id,
        session_id=session_id,
        operation="export",
        arguments=body.model_dump(mode="json"),
        response_model=ExportSimulationApiResponse,
        runner=_runner,
        upload_folder=get_upload_folder(),
    )
