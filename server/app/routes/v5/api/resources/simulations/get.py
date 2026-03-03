"""Simulations get endpoint - v4 API.

Provides get endpoint for fetching simulations by IDs.
"""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.api.resources.simulations.types import (
    GetSimulationsApiRequest,
    GetSimulationsApiResponse,
)
from app.routes.v5.tools.resources.simulations.get import (
    SQL_PATH,
    get_simulations_internal,
)
from app.sql.types import load_sql_query
from app.utils.error.handle_route_error import handle_route_error

# Load SQL with types at module level
router = APIRouter()

# =============================================================================
# Internal Function
# =============================================================================

# =============================================================================
# HTTP Endpoint
# =============================================================================

@router.post("/simulations/get", response_model=GetSimulationsApiResponse)
async def get_simulations(
    request: GetSimulationsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSimulationsApiResponse:
    """Get simulations by IDs."""
    tags = ["resources", "simulations"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Check for cache bypass header
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        # Use internal function
        items = await get_simulations_internal(
            conn=conn,
            ids=request.ids or [],
            bypass_cache=bypass_cache,
        )

        api_response = GetSimulationsApiResponse(items=items)

        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_simulations",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
