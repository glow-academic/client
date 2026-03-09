"""Tool update endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.tool_update.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.globals import get_pool, get_redis_client
from app.infra.tool_update import update_tool_client
from app.routes.v5.api.main.tool.types import (
    UpdateToolApiRequest,
    UpdateToolApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/update", response_model=UpdateToolApiResponse)
async def update_tool(
    request: UpdateToolApiRequest,
    http_request: Request,
    response: Response,
) -> UpdateToolApiResponse:
    """Update tools using composable infra architecture."""
    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        pool = get_pool()
        redis = get_redis_client()

        response_data = await update_tool_client(
            pool,
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
            operation="update_tool",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
