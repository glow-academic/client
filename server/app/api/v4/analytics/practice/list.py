"""Practice history endpoint - POST /practice/history"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetPracticeHistoryApiRequest,
                           GetPracticeHistoryApiResponse,
                           GetPracticeHistorySqlParams,
                           GetPracticeHistorySqlRow)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed
from fastapi import APIRouter, Depends, HTTPException, Request, Response

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/practice/get_practice_history_complete.sql"

router = APIRouter()


@router.post(
    "/list",
    response_model=GetPracticeHistoryApiResponse,
    dependencies=[
        audit_activity("practice.list", "{{ actor.name }} viewed practice history")
    ],
)
async def get_practice_history(
    request: GetPracticeHistoryApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetPracticeHistoryApiResponse:
    """Get paginated practice history with search, filters, sorting, and pagination."""
    tags = ["practice", "history"]

    # Check for cache bypass header (for hard refresh)
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
            return GetPracticeHistoryApiResponse.model_validate(cached["data"])

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

        # Profile ID must be a valid UUID (guest profile IDs are resolved on the client side)

        # Convert API request to SQL params (add profile_id from header)
        # Use double star pattern: **request.model_dump()
        params = GetPracticeHistorySqlParams(
            **request.model_dump(), profile_id=profile_id
        )
        sql_params = params.to_tuple()

        # Disable JIT compilation for this complex query to avoid re-compilation overhead
        async with conn.transaction():
            await conn.execute("SET LOCAL jit = off;")
            # Execute query with typed helper - automatically detects and calls function if present
            result = cast(
                GetPracticeHistorySqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

        # Set audit context (actor_name not returned from SQL, fetch separately if needed)
        # For now, we'll skip actor_name since it's not critical for history endpoint
        # If needed, we can add it to the SQL function later

        # Convert SQL result to API response
        api_response = GetPracticeHistoryApiResponse.model_validate(result.model_dump())

        # Cache response with profile-specific tags
        # Add profile-specific tags for granular invalidation
        profile_specific_tags = tags + [
            f"practice:profile:{profile_id}",
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
            operation="get_practice_history",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
