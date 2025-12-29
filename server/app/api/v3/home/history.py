"""Home history endpoint - POST /home/history"""

from typing import Annotated, Any, cast, Dict

import asyncpg
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetHomeHistoryApiRequest,
    GetHomeHistoryApiResponse,
    GetHomeHistorySqlParams,
    GetHomeHistorySqlRow,
)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/home/get_home_history_complete.sql"

router = APIRouter()


@router.post(
    "/history",
    response_model=GetHomeHistoryApiResponse,
    dependencies=[
        audit_activity("home.history", "{{ actor.name }} viewed home history")
    ],
)
async def get_home_history(
    request: GetHomeHistoryApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetHomeHistoryApiResponse:
    """Get paginated home history with search, filters, sorting, and pagination."""
    tags = ["home", "history"]

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
            return GetHomeHistoryApiResponse.model_validate(cached["data"])

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
        # Use double-star pattern - SQL handles page/offset_count calculation via COALESCE in params CTE
        # Note: model_dump(mode='json') returns strings for dates at runtime, but type checker infers datetime
        params = GetHomeHistorySqlParams(**request.model_dump(mode="json"), profile_id=profile_id)  # type: ignore[arg-type]
        sql_params = params.to_tuple()

        # Execute query with typed helper - automatically detects and calls function if present
        result = cast(
            GetHomeHistorySqlRow,
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
        api_response = GetHomeHistoryApiResponse.model_validate(result.model_dump())

        # Cache response with profile-specific tags
        # Add profile-specific tags for granular invalidation
        profile_specific_tags = tags + [
            f"home:profile:{profile_id}",
            f"history:profile:{profile_id}",
        ]
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=300,
            tags=profile_specific_tags,
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
            operation="get_home_history",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
