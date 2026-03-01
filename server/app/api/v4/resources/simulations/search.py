"""Simulations search endpoint - v4 API.

Provides search endpoint for simulations with suggest_source pattern.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.resources.simulations.types import (
    GetSimulationsV4Item,
    SearchSimulationsApiRequest,
    SearchSimulationsApiResponse,
    SearchSimulationsSqlRow,
)
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import SearchSimulationsSqlParams, load_sql_query
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/sql/v4/queries/resources/simulations/search_simulations_complete.sql"

router = APIRouter()


async def search_simulations_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    draft_id: UUID | None = None,
    suggest_source: str | None = "all",
    exclude_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    scenario_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    cohort: bool = False,
    simulation: bool = False,
) -> list[GetSimulationsV4Item]:
    """Internal function for searching simulations.

    Args:
        conn: Database connection
        search: Search term to filter by name/description
        limit_count: Maximum number of results
        offset_count: Offset for pagination
        draft_id: Optional draft ID for filtering by draft connection
        suggest_source: Source for suggestions ('all', 'linked', 'draft')
        exclude_ids: IDs to exclude from results
        bypass_cache: Whether to bypass cache

    Returns:
        List of simulation items
    """
    # Generate cache key
    cache_key_val = cache_key(
        "simulations/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "draft_id": str(draft_id) if draft_id else None,
            "suggest_source": suggest_source,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "department_ids": sorted(str(i) for i in (department_ids or [])),
            "scenario_ids": sorted(str(i) for i in (scenario_ids or [])),
            "cohort": cohort,
            "simulation": simulation,
        },
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                GetSimulationsV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    # Execute SQL
    params = SearchSimulationsSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        draft_id=draft_id,
        suggest_source=suggest_source,
        exclude_ids=exclude_ids or [],
        department_ids=department_ids or [],
        scenario_ids=scenario_ids or [],
        cohort=cohort,
        simulation=simulation,
    )

    result = cast(
        SearchSimulationsSqlRow,
        await execute_sql_typed(
            conn,
            SQL_PATH,
            params=params,
        ),
    )

    # Convert auto-generated Q* types to handcrafted types via dict roundtrip
    items: list[GetSimulationsV4Item] = [
        GetSimulationsV4Item.model_validate(
            item.model_dump() if hasattr(item, "model_dump") else item
        )
        for item in (result.items or [])
    ]

    # Cache response
    await set_cached(
        cache_key_val,
        {"data": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["simulations"],
    )

    return items


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
