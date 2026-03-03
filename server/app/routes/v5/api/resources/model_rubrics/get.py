"""Model rubrics get endpoint - v4 API.

Provides get endpoint for fetching model rubrics by resource IDs.
"""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.model_rubrics.get import (
    SQL_PATH,
    get_model_rubrics_internal,
)
from app.sql.types import (
    GetModelRubricsApiRequest,
    GetModelRubricsApiResponse,
    load_sql_query,
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
    "/model_rubrics/get",
    response_model=GetModelRubricsApiResponse,
)
async def get_model_rubrics(
    request: GetModelRubricsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetModelRubricsApiResponse:
    """Get model rubrics by resource IDs."""
    tags = ["resources", "model_rubrics"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        items = await get_model_rubrics_internal(
            conn=conn,
            ids=request.ids or [],
            bypass_cache=bypass_cache,
        )

        api_response = GetModelRubricsApiResponse(items=items)
        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_model_rubrics",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
