"""Tool export endpoint — composable infra architecture."""

from uuid import UUID

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

from app.infra.events.audit import run_artifact_operation_with_audit
from app.infra.globals import get_pool, get_redis_client, get_upload_folder
from app.infra.tool.export import export_tool_impl
from app.routes.v5.api.main.tool.types import ExportToolApiResponse

router = APIRouter()


class ExportToolApiRequest(BaseModel):
    """Request model for tool export."""

    tool_id: UUID | None = None


@router.post("/export", response_model=ExportToolApiResponse)
async def export_tools(
    body: ExportToolApiRequest,
    http_request: Request,
    response: Response,
) -> ExportToolApiResponse:
    """Export all tools as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id
    pool = get_pool()
    redis = get_redis_client()

    async def _runner() -> ExportToolApiResponse:
        return await export_tool_impl(
            pool,
            redis,
            profile_id=profile_id,
            session_id=session_id,
            tool_id=body.tool_id,
        )

    return await run_artifact_operation_with_audit(
        pool,
        redis,
        artifact="tool",
        profile_id=profile_id,
        session_id=session_id,
        operation="export",
        arguments=body.model_dump(mode="json"),
        response_model=ExportToolApiResponse,
        runner=_runner,
        upload_folder=get_upload_folder(),
    )
