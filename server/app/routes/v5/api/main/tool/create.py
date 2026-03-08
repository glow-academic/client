"""Tool create endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.tool_create.
"""

from __future__ import annotations

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.infra.tool_create import create_tool_client
from app.routes.v5.api.main.tool.types import (
    CreateToolApiRequest,
    CreateToolApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/create", response_model=CreateToolApiResponse)
async def create_tool(
    request: CreateToolApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateToolApiResponse:
    """Create tools using composable infra architecture."""
    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()

        response_data = await create_tool_client(
            conn,
            redis,
            profile_id=profile_id,
            items=request.tools,
            group_id=request.group_id,
        )

        response.headers["X-Invalidate-Tags"] = "tools"
        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_tool",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
