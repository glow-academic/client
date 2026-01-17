"""Home overview endpoint - POST /home/overview"""

from typing import Annotated, Any, cast

import asyncpg
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetHomeOverviewApiRequest,
                           GetHomeOverviewApiResponse,
                           GetHomeOverviewSqlParams, GetHomeOverviewSqlRow)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed
from fastapi import APIRouter, Depends, HTTPException, Request, Response

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/home/get_home_overview_complete.sql"

router = APIRouter()


@router.post(
    "/overview",
    response_model=GetHomeOverviewApiResponse,
    dependencies=[
        audit_activity("home.overview", "{{ actor.name }} viewed home overview")
    ],
)
async def get_home_overview(
    request: GetHomeOverviewApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetHomeOverviewApiResponse:
    """Get home overview with items and mappings.

    Home always shows general simulations only (no simulationFilters parameter).
    Bundle only returns top half (items + mappings), history is separate endpoint.
    """
    tags = ["home"]  # From router tags

    # Check for cache bypass header (for hard refresh)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    # Use mode='json' to serialize UUIDs to strings for JSON compatibility
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return GetHomeOverviewApiResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Convert API request to SQL params (add profile_id from header)
        # Use mode='json' to keep dates as ISO strings (SQL params model expects strings, not datetime objects)
        # Use double-star pattern - SQL handles defaults via COALESCE in params CTE
        # Note: model_dump(mode='json') returns strings for dates at runtime, but type checker infers datetime
        request_dict = request.model_dump(mode="json")
        params = GetHomeOverviewSqlParams(**request_dict, profile_id=profile_id)  # type: ignore[arg-type]
        sql_params = params.to_tuple()

        # Execute query with typed helper - automatically detects and calls function if present
        result = cast(
            GetHomeOverviewSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        # Convert SQL result to API response (no manual filtering needed - SQL handles it)
        api_response = GetHomeOverviewApiResponse.model_validate(result.model_dump())

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=300,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_home_overview",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
