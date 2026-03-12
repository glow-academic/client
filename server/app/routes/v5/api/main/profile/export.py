"""Profile export endpoint — composable infra architecture."""

from uuid import UUID

from fastapi import APIRouter, Request
from pydantic import BaseModel

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
) -> ExportProfileApiResponse:
    """Export all profiles as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    pool = get_pool()
    redis = get_redis_client()

    return await export_profile_impl(
        pool,
        redis,
        profile_id=profile_id,
        profile_export_id=body.profile_export_id,
    )
