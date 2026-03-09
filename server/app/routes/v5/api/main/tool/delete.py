"""Tool delete endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.tool_delete.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.globals import get_pool, get_redis_client
from app.infra.tool_delete import delete_tool_client
from app.routes.v5.api.main.tool.types import (
    DeleteToolApiRequest,
    DeleteToolApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/delete", response_model=DeleteToolApiResponse)
async def delete_tool(
    request: DeleteToolApiRequest,
    http_request: Request,
    response: Response,
) -> DeleteToolApiResponse:
    """Bulk delete tools — composable infra architecture."""
    tags = ["tools"]

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
        result = await delete_tool_client(
            pool,
            redis,
            profile_id=profile_id,
            tool_ids=request.tool_ids,
        )

        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_tool",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
