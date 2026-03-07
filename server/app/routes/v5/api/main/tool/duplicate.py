"""Tool duplicate endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.tool_duplicate.
"""

from __future__ import annotations

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.infra.tool_duplicate import duplicate_tool_client
from app.routes.v5.api.main.tool.types import (
    DuplicateToolApiRequest,
    DuplicateToolApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/duplicate",
    response_model=DuplicateToolApiResponse,
)
async def duplicate_tool(
    request: DuplicateToolApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateToolApiResponse:
    """Duplicate a tool — composable infra architecture."""
    tags = ["tools"]

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()
        result = await duplicate_tool_client(
            conn,
            redis,
            profile_id=profile_id,
            tool_id=request.tool_id,
        )

        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="duplicate_tool",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
