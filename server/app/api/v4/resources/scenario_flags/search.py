"""Scenario flags search endpoint - v4 API.

Provides search endpoint for finding available scenario flags for scenarios.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    QGetScenarioFlagsV4Item,
    SearchScenarioFlagsApiRequest,
    SearchScenarioFlagsApiResponse,
    SearchScenarioFlagsSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/resources/scenario_flags/search_scenario_flags_complete.sql"
)


router = APIRouter()


# =============================================================================
# Internal Function
# =============================================================================


# Handcrafted params to match SQL signature with artifact boolean filters
class SearchScenarioFlagsParams(BaseModel):
    scenario_ids: list[UUID] = []
    # Artifact boolean filters
    simulation: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.scenario_ids,
            self.simulation,
        )


async def search_scenario_flags_internal(
    conn: asyncpg.Connection,
    scenario_ids: list[UUID],
    bypass_cache: bool = False,
    *,
    simulation: bool = False,
) -> list[QGetScenarioFlagsV4Item]:
    """Internal function for parallel fetching from artifact endpoint.

    Args:
        conn: Database connection
        scenario_ids: List of scenario IDs to search flags for (empty = all scenarios)
        bypass_cache: Whether to bypass cache

    Returns:
        List of available scenario flag items
    """
    # Generate cache key
    cache_key_val = cache_key(
        "scenario_flags/search",
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
                QGetScenarioFlagsV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    # Execute SQL
    params = SearchScenarioFlagsParams(
        scenario_ids=scenario_ids or [],
        simulation=simulation,
    )
    result = cast(
        SearchScenarioFlagsSqlRow,
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
        tags=["scenario_flags"],
    )

    return items


# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/scenario_flags/search",
    response_model=SearchScenarioFlagsApiResponse,
)
async def search_scenario_flags(
    request: SearchScenarioFlagsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchScenarioFlagsApiResponse:
    """Search available scenario flags for scenarios."""
    tags = ["resources", "scenario_flags"]

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

        items = await search_scenario_flags_internal(
            conn=conn,
            scenario_ids=request.scenario_ids or [],
            bypass_cache=bypass_cache,
        )

        api_response = SearchScenarioFlagsApiResponse(items=items)
        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_scenario_flags",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
