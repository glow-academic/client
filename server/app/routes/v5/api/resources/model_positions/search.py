"""Model positions search endpoint - v4 API.

Provides search endpoint for finding available model positions for models.
"""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.model_positions.search import (
    SQL_PATH,
    search_model_positions_internal,
)
from app.sql.types import (
    SearchModelPositionsApiRequest,
    SearchModelPositionsApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/model_positions/search",
    response_model=SearchModelPositionsApiResponse,
)
async def search_model_positions(
    request: SearchModelPositionsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchModelPositionsApiResponse:
    """Search available model positions for models."""
    tags = ["resources", "model_positions"]

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

        items = await search_model_positions_internal(
            conn=conn,
            model_ids=request.model_ids or [],
            bypass_cache=bypass_cache,
            eval=request.eval or False,
        )

        api_response = SearchModelPositionsApiResponse(items=items)
        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_model_positions",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
