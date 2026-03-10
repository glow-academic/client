"""Setting export endpoint — composable infra architecture."""

from uuid import UUID

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

from app.infra.globals import get_pool, get_redis_client
from app.infra.setting.export import export_setting_impl
from app.routes.v5.api.main.setting.types import ExportSettingApiResponse

router = APIRouter()


class ExportSettingApiRequest(BaseModel):
    """Request model for setting export."""

    setting_id: UUID | None = None


@router.post("/export", response_model=ExportSettingApiResponse)
async def export_settings(
    body: ExportSettingApiRequest,
    http_request: Request,
    response: Response,
) -> ExportSettingApiResponse:
    """Export all settings as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id
    pool = get_pool()
    redis = get_redis_client()

    return await export_setting_impl(
        pool,
        redis,
        profile_id=profile_id,
        session_id=session_id,
        setting_id=body.setting_id,
    )
