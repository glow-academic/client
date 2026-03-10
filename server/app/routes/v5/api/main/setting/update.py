"""Setting update endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.setting.update.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.globals import get_pool, get_redis_client
from app.infra.setting.update import update_setting_impl
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
) -> UpdateSettingApiResponse:
    """Update settings using composable infra architecture."""
    try:
        profile_id = http_request.state.profile_id
        session_id = http_request.state.session_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        pool = get_pool()
        redis = get_redis_client()

        response_data = await update_setting_impl(
            pool,
            redis,
            profile_id=profile_id,
            items=request.settings,
            session_id=session_id,
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
