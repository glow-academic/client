"""Scenarios search endpoint - v4 API following DHH principles.

Searches scenarios with filtering and pagination.
"""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.api.main.simulation.types import (
    SearchScenariosApiRequest,
    SearchScenariosApiResponse,
)
from app.routes.v5.tools.resources.scenarios.search import search_scenarios_internal
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error

# SQL path for scenarios search
router = APIRouter()

@router.post("/scenarios/search", response_model=SearchScenariosApiResponse)
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
            department_ids=request.department_ids,
            suggest_source=request.suggest_source,
            exclude_ids=request.exclude_ids,
            bypass_cache=bypass_cache,
            scenario=request.scenario or False,
            simulation=request.simulation or False,
        )

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
