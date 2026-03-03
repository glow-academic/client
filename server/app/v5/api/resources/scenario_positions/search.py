"""Scenario positions search endpoint - v4 API.

Provides search endpoint for finding available scenario positions for scenarios.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db
from app.v5.sql.types import (
    QGetScenarioPositionsV4Item,
    SearchScenarioPositionsApiRequest,
    SearchScenarioPositionsApiResponse,
    SearchScenarioPositionsSqlParams,
    SearchScenarioPositionsSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/resources/scenario_positions/search_scenario_positions_complete.sql"

router = APIRouter()


async def search_scenario_positions_internal(
    conn: asyncpg.Connection,
    scenario_ids: list[UUID],
    bypass_cache: bool = False,
    *,
    simulation: bool = False,
) -> list[QGetScenarioPositionsV4Item]:
    """Internal function for parallel fetching from artifact endpoint.

    Args:
        conn: Database connection
        scenario_ids: List of scenario IDs to search positions for
        bypass_cache: Whether to bypass cache

    Returns:
        List of available scenario position items
    """
    # Generate cache key
    cache_key_val = cache_key(
        "scenario_positions/search",
        {
            "scenario_ids": sorted([str(id) for id in scenario_ids]),
            "simulation": simulation,
        },
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetScenarioPositionsV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    # Execute SQL
    params = SearchScenarioPositionsSqlParams(
        scenario_ids=scenario_ids or [],
        simulation=simulation,
    )
    result = cast(
        SearchScenarioPositionsSqlRow,
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
        tags=["scenario_positions"],
    )

    return items


# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/scenario_positions/search",
    response_model=SearchScenarioPositionsApiResponse,
)
async def search_scenario_positions(
    request: SearchScenarioPositionsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchScenarioPositionsApiResponse:
    """Search available scenario positions for scenarios."""
    tags = ["resources", "scenario_positions"]

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

        items = await search_scenario_positions_internal(
            conn=conn,
            scenario_ids=request.scenario_ids or [],
            bypass_cache=bypass_cache,
            simulation=request.simulation or False,
        )

        api_response = SearchScenarioPositionsApiResponse(items=items)
        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_scenario_positions",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
