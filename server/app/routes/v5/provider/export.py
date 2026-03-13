"""Provider export endpoint — composable infra architecture."""

from uuid import UUID

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.infra.globals import get_pool, get_redis_client
from app.infra.provider.export import export_provider_impl
from app.routes.v5.provider.types import ExportProviderApiResponse

router = APIRouter()


class ExportProviderApiRequest(BaseModel):
    """Request model for provider export."""

    provider_id: UUID | None = None


@router.post("/export", response_model=ExportProviderApiResponse)
async def export_providers(
    body: ExportProviderApiRequest,
    http_request: Request,
) -> ExportProviderApiResponse:
    """Export all providers as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    pool = get_pool()
    redis = get_redis_client()

    return await export_provider_impl(
        pool,
        redis,
        profile_id=profile_id,
        provider_id=body.provider_id,
    )
