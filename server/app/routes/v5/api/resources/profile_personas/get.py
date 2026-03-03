"""Profile personas get endpoint - v4 API.

Provides get endpoint for fetching profile personas by resource IDs.
"""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.profile_personas.get import (
    SQL_PATH,
    get_profile_personas_internal,
)
from app.sql.types import (
    GetProfilePersonasApiRequest,
    GetProfilePersonasApiResponse,
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
    "/profile_personas/get",
    response_model=GetProfilePersonasApiResponse,
)
async def get_profile_personas(
    request: GetProfilePersonasApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetProfilePersonasApiResponse:
    """Get profile personas by resource IDs."""
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

        items = await get_profile_personas_internal(
            conn=conn,
            ids=request.ids or [],
            bypass_cache=bypass_cache,
        )

        api_response = GetProfilePersonasApiResponse(items=items)
        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_profile_personas",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
