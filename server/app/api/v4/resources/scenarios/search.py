"""Scenarios search endpoint - v4 API following DHH principles.

Searches scenarios with filtering and pagination.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.api.v4.artifacts.simulation.types import (
    SearchScenariosApiRequest,
    SearchScenariosApiResponse,
    SearchScenariosSqlParams,
    SearchScenariosSqlRow,
    QGetScenariosV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# SQL path for scenarios search
SQL_PATH = "app/sql/v4/queries/resources/scenarios/search_scenarios_complete.sql"


router = APIRouter()


async def search_scenarios_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    user_department_ids: list[UUID] | None = None,
    suggest_source: str | None = None,
    exclude_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
) -> list[QGetScenariosV4Item]:
    """Internal function to search scenarios.

    Args:
        conn: Database connection
        search: Search term
        limit_count: Maximum number of results
        offset_count: Offset for pagination
        user_department_ids: User's department IDs for filtering
        suggest_source: Source for suggestions ('all', 'linked', 'recent')
        exclude_ids: IDs to exclude from results
        bypass_cache: Whether to bypass cache

    Returns:
        List of scenario items
    """
    tags = ["resources", "scenarios"]
    cache_key_val = cache_key(
        "/api/v4/resources/scenarios/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "user_department_ids": [str(i) for i in user_department_ids] if user_department_ids else None,
            "suggest_source": suggest_source,
            "exclude_ids": [str(i) for i in exclude_ids] if exclude_ids else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached and "items" in cached:
            return [QGetScenariosV4Item.model_validate(item) for item in cached["items"]]

    params = SearchScenariosSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        user_department_ids=user_department_ids,
        suggest_source=suggest_source,
        exclude_ids=exclude_ids,
    )

    result = cast(
        SearchScenariosSqlRow,
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


@router.post(
    "/scenarios/search",
    response_model=SearchScenariosApiResponse,
    dependencies=[
        audit_activity(
            "scenarios.search",
            "{{ actor.name }} searched scenarios",
        )
    ],
)
async def search_scenarios(
    request: SearchScenariosApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchScenariosApiResponse:
    """Search scenarios with filtering and pagination."""
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
            return SearchScenariosApiResponse.model_validate(cached["data"])

    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        items = await search_scenarios_internal(
            conn,
            search=request.search,
            limit_count=request.limit_count,
            offset_count=request.offset_count,
            user_department_ids=request.user_department_ids,
            suggest_source=request.suggest_source,
            exclude_ids=request.exclude_ids,
            bypass_cache=bypass_cache,
        )

        # Set audit context
        audit_set(http_request, actor={"id": profile_id})

        # Create response
        response_data = SearchScenariosApiResponse(items=items)

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
            operation="search_scenarios",
            sql_query=None,
            sql_params=sql_params,
            request=http_request,
        )
