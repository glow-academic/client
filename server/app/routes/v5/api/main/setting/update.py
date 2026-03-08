"""Setting update endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.setting_update.
"""

from __future__ import annotations

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.infra.setting_update import update_setting_client
from app.routes.v5.api.main.setting.types import (
    UpdateSettingApiRequest,
    UpdateSettingApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/update", response_model=UpdateSettingApiResponse)
async def update_setting(
    request: UpdateSettingApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateSettingApiResponse:
    """Update settings using composable infra architecture."""
    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()

        response_data = await update_setting_client(
            conn,
            redis,
            profile_id=profile_id,
            items=request.settings,
            group_id=request.group_id,
        )

        response.headers["X-Invalidate-Tags"] = "settings"
        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_setting",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
