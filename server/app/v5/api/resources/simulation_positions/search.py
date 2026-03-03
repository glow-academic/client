"""Simulation positions search endpoint - v4 API.

Provides search endpoint for simulation positions.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.resources.simulation_positions.types import (
    GetSimulationPositionsV4Item,
    SearchSimulationPositionsApiRequest,
    SearchSimulationPositionsApiResponse,
    SearchSimulationPositionsSqlRow,
)
from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import get_db
from app.v5.sql.types import SearchSimulationPositionsSqlParams, load_sql_query
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/v5/sql/queries/resources/simulation_positions/search_simulation_positions_complete.sql"

router = APIRouter()


async def search_simulation_positions_internal(
    conn: asyncpg.Connection,
    simulation_ids: list[UUID] | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    cohort: bool = False,
) -> list[GetSimulationPositionsV4Item]:
    """Internal function for searching simulation positions.

    Args:
        conn: Database connection
        simulation_ids: Optional simulation IDs to filter by
        limit_count: Maximum number of results
        offset_count: Offset for pagination
        exclude_ids: IDs to exclude from results
        bypass_cache: Whether to bypass cache

    Returns:
        List of simulation position items
    """
    # Generate cache key
    cache_key_val = cache_key(
        "simulation_positions/search",
        {
            "simulation_ids": [str(id) for id in (simulation_ids or [])],
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "cohort": cohort,
        },
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                GetSimulationPositionsV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    # Execute SQL
    params = SearchSimulationPositionsSqlParams(
        simulation_ids=simulation_ids or [],
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        cohort=cohort,
    )

    result = cast(
        SearchSimulationPositionsSqlRow,
        await execute_sql_typed(
            conn,
            SQL_PATH,
            params=params,
        ),
    )

    items = result.items or []

    # Cache response
    await set_cached(
        cache_key_val,
        {"data": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["simulation_positions"],
    )

    return items


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
