"""Department export endpoint — composable infra architecture."""

from uuid import UUID

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

from app.infra.department.export import export_department_impl
from app.infra.events.audit import run_artifact_operation_with_audit
from app.infra.globals import get_pool, get_redis_client, get_upload_folder
from app.routes.v5.api.main.department.types import ExportDepartmentApiResponse

router = APIRouter()


class ExportDepartmentApiRequest(BaseModel):
    """Request model for department export."""

    department_id: UUID | None = None


@router.post("/export", response_model=ExportDepartmentApiResponse)
async def export_departments(
    body: ExportDepartmentApiRequest,
    http_request: Request,
    response: Response,
) -> ExportDepartmentApiResponse:
    """Export all departments as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id
    pool = get_pool()
    redis = get_redis_client()

    async def _runner() -> ExportDepartmentApiResponse:
        return await export_department_impl(
            pool,
            redis,
            profile_id=profile_id,
            session_id=session_id,
            department_id=body.department_id,
        )

    return await run_artifact_operation_with_audit(
        pool,
        redis,
        artifact="department",
        profile_id=profile_id,
        session_id=session_id,
        operation="export",
        arguments=body.model_dump(mode="json"),
        response_model=ExportDepartmentApiResponse,
        runner=_runner,
        upload_folder=get_upload_folder(),
    )
