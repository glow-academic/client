"""Tool save endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.tool_save.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.globals import get_pool, get_redis_client
from app.infra.tool_save import save_tool_client
from app.routes.v5.api.main.tool.types import (
    SaveToolApiRequest,
    SaveToolApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/save", response_model=SaveToolApiResponse)
async def save_tool(
    request: SaveToolApiRequest,
    http_request: Request,
    response: Response,
) -> SaveToolApiResponse:
    """Save tools using composable infra architecture."""
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

        response_data = await save_tool_client(
            pool,
            redis,
            profile_id=profile_id,
            items=request.tools,
            session_id=session_id,
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
            operation="save_tool",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
