"""Simulation positions search endpoint - v4 API.

Provides search endpoint for simulation positions.
"""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.api.resources.simulation_positions.types import (
    SearchSimulationPositionsApiRequest,
    SearchSimulationPositionsApiResponse,
)
from app.routes.v5.tools.resources.simulation_positions.search import (
    SQL_PATH,
    search_simulation_positions_internal,
)
from app.sql.types import load_sql_query
from app.utils.error.handle_route_error import handle_route_error

# Load SQL with types at module level
router = APIRouter()

# =============================================================================
# HTTP Endpoint
# =============================================================================

@router.post(
    "/simulation_positions/search", response_model=SearchSimulationPositionsApiResponse
)
async def search_simulation_positions(
    request: SearchSimulationPositionsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchSimulationPositionsApiResponse:
    """Search simulation positions with optional filters."""
    tags = ["resources", "simulation_positions"]

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
        items = await search_simulation_positions_internal(
            conn=conn,
            simulation_ids=request.simulation_ids,
            limit_count=request.limit_count,
            offset_count=request.offset_count,
            exclude_ids=request.exclude_ids,
            bypass_cache=bypass_cache,
            cohort=request.cohort or False,
        )

        api_response = SearchSimulationPositionsApiResponse(items=items)

        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_simulation_positions",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
