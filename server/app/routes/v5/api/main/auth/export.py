"""Auth export endpoint — composable infra architecture."""

from uuid import UUID

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

from app.infra.auth.export import export_auth_impl
from app.infra.events.audit import run_artifact_operation_with_audit
from app.infra.globals import get_pool, get_redis_client, get_upload_folder
from app.routes.v5.api.main.auth.types import ExportAuthApiResponse

router = APIRouter()


class ExportAuthApiRequest(BaseModel):
    """Request model for auth export."""

    auth_id: UUID | None = None


@router.post("/export", response_model=ExportAuthApiResponse)
async def export_auths(
    body: ExportAuthApiRequest,
    http_request: Request,
    response: Response,
) -> ExportAuthApiResponse:
    """Export all auths as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id
    pool = get_pool()
    redis = get_redis_client()

    async def _runner() -> ExportAuthApiResponse:
        return await export_auth_impl(
            pool,
            redis,
            profile_id=profile_id,
            session_id=session_id,
            auth_id=body.auth_id,
        )

    return await run_artifact_operation_with_audit(
        pool,
        redis,
        artifact="auth",
        profile_id=profile_id,
        session_id=session_id,
        operation="export",
        arguments=body.model_dump(mode="json"),
        response_model=ExportAuthApiResponse,
        runner=_runner,
        upload_folder=get_upload_folder(),
    )
