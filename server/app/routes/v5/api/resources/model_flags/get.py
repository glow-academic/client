"""Model flags get endpoint - v4 API.

Provides get endpoint for fetching model flags by resource IDs.
"""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.model_flags.get import (
    get_model_flags as get_model_flags_resource,
)
from app.sql.types import (
    GetModelFlagsApiRequest,
    GetModelFlagsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# =============================================================================
# Internal Function
# =============================================================================

# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/model_flags/get",
    response_model=GetModelFlagsApiResponse,
)
async def get_model_flags(
    request: GetModelFlagsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetModelFlagsApiResponse:
    """Get model flags by resource IDs."""
    tags = ["resources", "model_flags"]

    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        items = await get_model_flags_resource(
            conn=conn,
            ids=request.ids or [],
            redis=get_redis_client(),
            bypass_cache=bypass_cache,
        )

        api_response = GetModelFlagsApiResponse(items=items)
        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_model_flags",
            sql_query=None,
            sql_params=sql_params,
            request=http_request,
        )
