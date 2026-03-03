"""Profile personas search endpoint - v4 API.

Provides search endpoint for finding available profile personas for profiles.
"""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.profile_personas.search import (
    SQL_PATH,
    search_profile_personas_internal,
)
from app.sql.types import (
    SearchProfilePersonasApiRequest,
    SearchProfilePersonasApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# =============================================================================
# HTTP Endpoint
# =============================================================================

@router.post(
    "/profile_personas/search",
    response_model=SearchProfilePersonasApiResponse,
)
async def search_profile_personas(
    request: SearchProfilePersonasApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchProfilePersonasApiResponse:
    """Search available profile personas for profiles."""
    tags = ["resources", "profile_personas"]

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

        items = await search_profile_personas_internal(
            conn=conn,
            profile_ids=request.profile_ids or [],
            bypass_cache=bypass_cache,
            cohort=request.cohort or False,
        )

        api_response = SearchProfilePersonasApiResponse(items=items)
        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_profile_personas",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
