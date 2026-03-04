"""Cohorts GET endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.api.resources.cohorts.types import (
    GetCohortsApiRequest,
    GetCohortsApiResponse,
)
from app.routes.v5.tools.resources.cohorts.get import get_cohorts_internal
from app.utils.error.handle_route_error import handle_route_error

# Load SQL with types at module level
router = APIRouter()

# =============================================================================
# Internal Function
# =============================================================================

# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/cohorts/get",
    response_model=GetCohortsApiResponse,
)
async def get_cohorts(
    request: GetCohortsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetCohortsApiResponse:
    """Get cohorts resources by IDs.

    HTTP wrapper that delegates to internal function for caching and data fetching.
    """
    tags = ["resources", "cohorts"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_cohorts_internal(conn, request.ids or [], bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetCohortsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_cohorts",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
