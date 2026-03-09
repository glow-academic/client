"""Tool export endpoint — composable infra architecture."""

from uuid import UUID

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

from app.infra.globals import get_pool, get_redis_client
from app.infra.tool_export import export_tool_client
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

    return await export_tool_client(
        pool,
        redis,
        profile_id=profile_id,
        session_id=session_id,
        tool_id=body.tool_id,
    )
