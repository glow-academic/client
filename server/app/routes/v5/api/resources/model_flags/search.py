"""Model flags search endpoint - v4 API.

Provides search endpoint for finding available model flags for models.
"""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.model_flags.search import (
    SQL_PATH,
    search_model_flags_internal,
)
from app.sql.types import (
    SearchModelFlagsApiRequest,
    SearchModelFlagsApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# =============================================================================
# HTTP Endpoint
# =============================================================================

@router.post(
    "/model_flags/search",
    response_model=SearchModelFlagsApiResponse,
)
async def search_model_flags(
    request: SearchModelFlagsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchModelFlagsApiResponse:
    """Search available model flags for models."""
    tags = ["resources", "model_flags"]

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

        items = await search_model_flags_internal(
            conn=conn,
            search=request.search if hasattr(request, "search") else None,
            limit_count=request.limit_count if hasattr(request, "limit_count") else 20,
            offset_count=request.offset_count
            if hasattr(request, "offset_count")
            else 0,
            exclude_ids=request.exclude_ids if hasattr(request, "exclude_ids") else [],
            model_ids=request.model_ids or [],
            bypass_cache=bypass_cache,
            eval=request.eval or False,
        )

        api_response = SearchModelFlagsApiResponse(items=items)
        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_model_flags",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
