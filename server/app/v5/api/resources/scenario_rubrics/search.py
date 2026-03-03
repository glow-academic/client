"""Scenario rubrics search endpoint - v4 API.

Provides search endpoint for finding available scenario rubrics for scenarios.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db
from app.v5.sql.types import (
    QGetScenarioRubricsV4Item,
    SearchScenarioRubricsApiRequest,
    SearchScenarioRubricsApiResponse,
    SearchScenarioRubricsSqlParams,
    SearchScenarioRubricsSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/v5/sql/queries/resources/scenario_rubrics/search_scenario_rubrics_complete.sql"
)

router = APIRouter()


async def search_scenario_rubrics_internal(
    conn: asyncpg.Connection,
    scenario_ids: list[UUID],
    rubric_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    simulation: bool = False,
) -> list[QGetScenarioRubricsV4Item]:
    """Internal function for parallel fetching from artifact endpoint.

    Args:
        conn: Database connection
        scenario_ids: List of scenario IDs to search rubrics for
        bypass_cache: Whether to bypass cache

    Returns:
        List of available scenario rubric items
    """
    # Generate cache key
    cache_key_val = cache_key(
        "scenario_rubrics/search",
        {
            "scenario_ids": sorted([str(id) for id in scenario_ids]),
            "rubric_ids": sorted(str(i) for i in (rubric_ids or [])),
            "simulation": simulation,
        },
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetScenarioRubricsV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    # Execute SQL
    params = SearchScenarioRubricsSqlParams(
        scenario_ids=scenario_ids or [],
        rubric_ids=rubric_ids or [],
        simulation=simulation,
    )
    result = cast(
        SearchScenarioRubricsSqlRow,
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
        tags=["scenario_rubrics"],
    )

    return items


# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/scenario_rubrics/search",
    response_model=SearchScenarioRubricsApiResponse,
)
async def search_scenario_rubrics(
    request: SearchScenarioRubricsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchScenarioRubricsApiResponse:
    """Search available scenario rubrics for scenarios."""
    tags = ["resources", "scenario_rubrics"]

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

        items = await search_scenario_rubrics_internal(
            conn=conn,
            scenario_ids=request.scenario_ids or [],
            bypass_cache=bypass_cache,
            simulation=request.simulation or False,
        )

        api_response = SearchScenarioRubricsApiResponse(items=items)
        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_scenario_rubrics",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
