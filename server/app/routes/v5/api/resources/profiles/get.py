"""Profiles get endpoint - v4 API.

Provides batch get endpoint for fetching profiles by IDs.
"""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.profiles.get import SQL_PATH, get_profiles_internal
from app.sql.types import (
    GetProfilesApiRequest,
    GetProfilesApiResponse,
    load_sql_query,
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
    "/profiles/get",
    response_model=GetProfilesApiResponse,
)
async def get_profiles(
    request: GetProfilesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetProfilesApiResponse:
    """Get profiles resources by IDs.

    HTTP wrapper that delegates to internal function for caching and data fetching.
    """
    tags = ["resources", "profiles"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_profiles_internal(conn, request.p_ids or [], bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetProfilesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_profiles",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
