"""Scenarios get endpoint - v4 API following DHH principles.

Returns scenario details for given IDs.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.main.simulation.types import (
    GetScenariosApiRequest,
    GetScenariosApiResponse,
    GetScenariosSqlParams,
    GetScenariosSqlRow,
    QGetScenariosV4Item,
)
from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# SQL path for scenarios get
SQL_PATH = "app/sql/queries/resources/scenarios/get_scenarios_complete.sql"

router = APIRouter()


async def get_scenarios_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetScenariosV4Item]:
    """Internal function to fetch scenarios by IDs.

    Args:
        conn: Database connection
        ids: List of scenario IDs to fetch
        bypass_cache: Whether to bypass cache

    Returns:
        List of scenario items
    """
    if not ids:
        return []

    tags = ["resources", "scenarios"]
    cache_key_val = cache_key(
        "/api/v5/resources/scenarios/get", {"ids": [str(i) for i in ids]}
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached and "items" in cached:
            return [
                QGetScenariosV4Item.model_validate(item) for item in cached["items"]
            ]

    params = GetScenariosSqlParams(ids=ids)

    result = cast(
        GetScenariosSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items = result.items or []

    # Cache the result
    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


@router.post("/scenarios/get", response_model=GetScenariosApiResponse)
async def get_scenarios(
    request: GetScenariosApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetScenariosApiResponse:
    """Get scenarios by IDs."""
    tags = ["resources", "scenarios"]

    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return GetScenariosApiResponse.model_validate(cached["data"])

    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        items = await get_scenarios_internal(conn, request.ids, bypass_cache)

        # Create response
        response_data = GetScenariosApiResponse(items=items)

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump(mode="json")},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_scenarios",
            sql_query=None,
            sql_params=sql_params,
            request=http_request,
        )
