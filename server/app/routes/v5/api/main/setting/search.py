"""Setting search endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.setting_search.
"""

from __future__ import annotations

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.globals import get_db, get_redis_client
from app.infra.setting_search import search_setting_client
from app.routes.v5.api.main.setting.types import ListSettingApiResponse
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


class SearchSettingApiRequest(BaseModel):
    """Request model for setting search endpoint."""

    pass


@router.post("/search", response_model=ListSettingApiResponse)
async def search_setting(
    request: SearchSettingApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListSettingApiResponse:
    """Search settings — composable infra architecture."""
    tags = ["settings"]

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()
        result = await search_setting_client(
            conn,
            redis,
            profile_id=profile_id,
        )

        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_setting",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
