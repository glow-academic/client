"""Scenario positions get endpoint - v4 API.

Provides get endpoint for fetching scenario positions by resource IDs.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetScenarioPositionsApiRequest,
    GetScenarioPositionsApiResponse,
    GetScenarioPositionsSqlParams,
    GetScenarioPositionsSqlRow,
    QGetScenarioPositionsV4Item,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/resources/scenario_positions/get_scenario_positions_complete.sql"


router = APIRouter()


# =============================================================================
# Internal Function
# =============================================================================


async def get_scenario_positions_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetScenarioPositionsV4Item]:
    """Internal function for parallel fetching from artifact endpoint.

    Args:
        conn: Database connection
        ids: List of scenario position resource IDs
        bypass_cache: Whether to bypass cache

    Returns:
        List of scenario position items
    """
    if not ids:
        return []

    # Generate cache key
    cache_key_val = cache_key(
        "scenario_positions/get",
        {
            "ids": sorted([str(id) for id in ids]),
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
    params = GetScenarioPositionsSqlParams(ids=ids)
    result = cast(
        GetScenarioPositionsSqlRow,
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
    "/scenario_positions/get",
    response_model=GetScenarioPositionsApiResponse,
)
async def get_scenario_positions(
    request: GetScenarioPositionsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetScenarioPositionsApiResponse:
    """Get scenario positions by resource IDs."""
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

        items = await get_scenario_positions_internal(
            conn=conn,
            ids=request.ids or [],
            bypass_cache=bypass_cache,
        )

        api_response = GetScenarioPositionsApiResponse(items=items)
        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_scenario_positions",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
