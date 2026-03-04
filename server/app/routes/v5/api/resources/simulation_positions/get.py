"""Simulation positions get endpoint - v4 API.

Provides get endpoint for fetching simulation positions by simulation IDs.
"""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.api.resources.simulation_positions.types import (
    GetSimulationPositionsApiRequest,
    GetSimulationPositionsApiResponse,
)
from app.routes.v5.tools.resources.simulation_positions.get import (
    get_simulation_positions as get_simulation_positions_resource,
)
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
    "/simulation_positions/get", response_model=GetSimulationPositionsApiResponse
)
async def get_simulation_positions(
    request: GetSimulationPositionsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSimulationPositionsApiResponse:
    """Get simulation positions by simulation IDs."""
    tags = ["resources", "simulation_positions"]

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
        items = await get_simulation_positions_resource(
            conn=conn,
            simulation_ids=request.simulation_ids,
            redis=get_redis_client(),
            bypass_cache=bypass_cache,
        )

        api_response = GetSimulationPositionsApiResponse(items=items)

        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_simulation_positions",
            sql_query=None,
            sql_params=sql_params,
            request=http_request,
        )
