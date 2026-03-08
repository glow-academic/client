"""Setting export endpoint — composable infra architecture."""

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from redis.asyncio import Redis

from app.infra.globals import get_db, get_redis_client
from app.infra.setting_export import export_setting_client
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
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis_client)],
) -> ExportSettingApiResponse:
    """Export all settings as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    return await export_setting_client(
        conn,
        redis,
        profile_id=profile_id,
        session_id=session_id,
        setting_id=body.setting_id,
    )
