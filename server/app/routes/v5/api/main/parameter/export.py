"""Parameter export endpoint — composable infra architecture."""

from uuid import UUID

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.infra.globals import get_pool, get_redis_client
from app.infra.parameter.export import export_parameter_impl
from app.routes.v5.api.main.parameter.types import ExportParameterApiResponse

router = APIRouter()


class ExportParameterApiRequest(BaseModel):
    """Request model for parameter export."""

    parameter_id: UUID | None = None


@router.post("/export", response_model=ExportParameterApiResponse)
async def export_parameters(
    body: ExportParameterApiRequest,
    http_request: Request,
) -> ExportParameterApiResponse:
    """Export all parameters as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    pool = get_pool()
    redis = get_redis_client()

    return await export_parameter_impl(
        pool,
        redis,
        profile_id=profile_id,
        parameter_id=body.parameter_id,
    )
