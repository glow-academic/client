"""Profile export endpoint — composable infra architecture."""

from uuid import UUID

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

from app.infra.events.audit import run_artifact_operation_with_audit
from app.infra.globals import get_pool, get_redis_client
from app.infra.profile.export import export_profile_impl
from app.routes.v5.api.main.profile.types import ExportProfileApiResponse

router = APIRouter()


class ExportProfileApiRequest(BaseModel):
    """Request model for profile export."""

    profile_export_id: UUID | None = None


@router.post("/export", response_model=ExportProfileApiResponse)
async def export_profiles(
    body: ExportProfileApiRequest,
    http_request: Request,
    response: Response,
) -> ExportProfileApiResponse:
    """Export all profiles as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id
    pool = get_pool()
    redis = get_redis_client()

    async def _runner() -> ExportProfileApiResponse:
        return await export_profile_impl(
            pool,
            redis,
            profile_id=profile_id,
            session_id=session_id,
            profile_export_id=body.profile_export_id,
        )

    return await run_artifact_operation_with_audit(
        pool,
        redis,
        artifact="profile",
        profile_id=profile_id,
        session_id=session_id,
        operation="export",
        arguments=body.model_dump(mode="json"),
        response_model=ExportProfileApiResponse,
        runner=_runner,
    )
