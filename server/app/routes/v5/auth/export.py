"""Auth export endpoint — composable infra architecture."""

from uuid import UUID

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.infra.auth.export import export_auth_impl
from app.infra.globals import get_pool, get_redis_client
from app.routes.v5.auth.types import ExportAuthApiResponse

router = APIRouter()


class ExportAuthApiRequest(BaseModel):
    """Request model for auth export."""

    auth_id: UUID | None = None


@router.post("/export", response_model=ExportAuthApiResponse)
async def export_auths(
    body: ExportAuthApiRequest,
    http_request: Request,
) -> ExportAuthApiResponse:
    """Export all auths as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    pool = get_pool()
    redis = get_redis_client()

    return await export_auth_impl(
        pool,
        redis,
        profile_id=profile_id,
        auth_id=body.auth_id,
    )
