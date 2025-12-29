"""Leaderboard bundle v3 API endpoint."""

from datetime import datetime
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetLeaderboardBundleApiRequest,
    GetLeaderboardBundleApiResponse,
    GetLeaderboardBundleSqlParams,
    GetLeaderboardBundleSqlRow,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/leaderboard/get_leaderboard_bundle_complete.sql"

router = APIRouter()


@router.post(
    "/bundle",
    response_model=GetLeaderboardBundleApiResponse,
    dependencies=[
        audit_activity("leaderboard.bundle", "{{ actor.name }} viewed leaderboard")
    ],
)
async def get_leaderboard(
    request: GetLeaderboardBundleApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetLeaderboardBundleApiResponse:
    """Get leaderboard bundle with all metrics and profile data."""
    tags = ["leaderboard"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetLeaderboardBundleApiResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        # Note: profile_id is read for consistency but not used for filtering
        # Leaderboard shows aggregated data across all profiles
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Convert API request to SQL params (add profile_id from header)
        # Use double-star pattern - SQL handles defaults via COALESCE in params CTE
        params = GetLeaderboardBundleSqlParams(
            **request.model_dump(), profile_id=profile_id
        )
        # Convert date strings to datetime objects for asyncpg timestamptz parameters
        # execute_sql_typed calls params.to_tuple() internally, so we need to modify the params object
        params.start_date = datetime.fromisoformat(
            params.start_date.replace("Z", "+00:00")
        )  # type: ignore[assignment]
        params.end_date = datetime.fromisoformat(params.end_date.replace("Z", "+00:00"))  # type: ignore[assignment]
        sql_params = params.to_tuple()

        # Execute query with typed helper - automatically detects and calls function if present
        result = cast(
            GetLeaderboardBundleSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        # Convert SQL result to API response
        api_response = GetLeaderboardBundleApiResponse.model_validate(
            result.model_dump()
        )

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
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_leaderboard",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
