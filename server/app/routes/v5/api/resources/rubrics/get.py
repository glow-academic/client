"""Rubrics get endpoint - v4 API.

Provides get endpoint for fetching rubrics by simulation ID.
"""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.rubrics.get import (
    get_rubrics as get_rubrics_resource,
)
from app.sql.types import (
    GetRubricsApiRequest,
    GetRubricsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# =============================================================================
# Internal Functions
# =============================================================================

# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/rubrics/get",
    response_model=GetRubricsApiResponse,
)
async def get_rubrics(
    request: GetRubricsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetRubricsApiResponse:
    """Get rubrics by simulation ID."""
    tags = ["resources", "rubrics"]

    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        items = await get_rubrics_resource(
            conn=conn,
            ids=request.ids if hasattr(request, "ids") else [],
            redis=get_redis_client(),
            bypass_cache=bypass_cache,
        )

        api_response = GetRubricsApiResponse(items=items)
        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_rubrics",
            sql_query=None,
            sql_params=sql_params,
            request=http_request,
        )
