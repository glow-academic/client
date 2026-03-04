"""Scenarios get endpoint - v4 API following DHH principles.

Returns scenario details for given IDs.
"""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.api.main.simulation.types import (
    GetScenariosApiRequest,
    GetScenariosApiResponse,
)
from app.routes.v5.tools.resources.scenarios.get import get_scenarios_internal
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error

# SQL path for scenarios get
router = APIRouter()


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
        cached = await get_cached(cache_key_val, redis=get_redis_client())
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
            redis=get_redis_client(),
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
