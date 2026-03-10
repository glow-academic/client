"""Cohort export endpoint — composable infra architecture."""

from uuid import UUID

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

from app.infra.cohort.export import export_cohort_impl
from app.infra.events.audit import run_artifact_operation_with_audit
from app.infra.globals import get_pool, get_redis_client, get_upload_folder
from app.routes.v5.api.main.cohort.types import ExportCohortApiResponse

router = APIRouter()


class ExportCohortApiRequest(BaseModel):
    """Request model for cohort export."""

    cohort_id: UUID | None = None


@router.post("/export", response_model=ExportCohortApiResponse)
async def export_cohorts(
    body: ExportCohortApiRequest,
    http_request: Request,
    response: Response,
) -> ExportCohortApiResponse:
    """Export all cohorts as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id
    pool = get_pool()
    redis = get_redis_client()

    async def _runner() -> ExportCohortApiResponse:
        return await export_cohort_impl(
            pool,
            redis,
            profile_id=profile_id,
            session_id=session_id,
            cohort_id=body.cohort_id,
        )

    return await run_artifact_operation_with_audit(
        pool,
        redis,
        artifact="cohort",
        profile_id=profile_id,
        session_id=session_id,
        operation="export",
        arguments=body.model_dump(mode="json"),
        response_model=ExportCohortApiResponse,
        runner=_runner,
        upload_folder=get_upload_folder(),
    )
