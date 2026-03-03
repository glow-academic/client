"""Simulations search endpoint - v4 API.

Provides search endpoint for simulations with suggest_source pattern.
"""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.api.resources.simulations.types import (
    SearchSimulationsApiRequest,
    SearchSimulationsApiResponse,
)
from app.routes.v5.tools.resources.simulations.search import (
    SQL_PATH,
    search_simulations_internal,
)
from app.sql.types import load_sql_query
from app.utils.error.handle_route_error import handle_route_error

# Load SQL with types at module level
router = APIRouter()

# =============================================================================
# HTTP Endpoint
# =============================================================================

@router.post("/simulations/search", response_model=SearchSimulationsApiResponse)
async def search_simulations(
    request: SearchSimulationsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchSimulationsApiResponse:
    """Search simulations with optional filters."""
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
        items = await search_simulations_internal(
            conn=conn,
            search=request.search,
            limit_count=request.limit_count,
            offset_count=request.offset_count,
            draft_id=request.draft_id,
            suggest_source=request.suggest_source,
            exclude_ids=request.exclude_ids,
            bypass_cache=bypass_cache,
            cohort=request.cohort or False,
            simulation=request.simulation or False,
        )

        api_response = SearchSimulationsApiResponse(items=items)

        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_simulations",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
