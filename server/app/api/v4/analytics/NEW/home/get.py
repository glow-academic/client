"""Home overview endpoint - POST /home/get.

Uses api_get_home_overview_new_v4 SQL function that queries MVs with JOINs to _resource tables.
"""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetHomeOverviewNewApiRequest,
    GetHomeOverviewNewApiResponse,
    GetHomeOverviewNewSqlParams,
    GetHomeOverviewNewSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/analytics/NEW/home/get_home_overview_new_complete.sql"

router = APIRouter()


@router.post(
    "/get",
    response_model=GetHomeOverviewNewApiResponse,
    dependencies=[
        audit_activity("home.new.get", "{{ actor.name }} viewed new home overview")
    ],
)
async def home_get(
    request: GetHomeOverviewNewApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetHomeOverviewNewApiResponse:
    """Get home overview with simulation cards.

    Uses SQL function that queries mv_home_simulation_status with JOINs
    to _resource tables for metadata.
    """
    tags = ["home", "new"]

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
            return GetHomeOverviewNewApiResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Convert API request to SQL params
        request_dict = request.model_dump(mode="json")
        params = GetHomeOverviewNewSqlParams(
            **request_dict, profile_id=profile_id
        )  # type: ignore[arg-type]
        sql_params = params.to_tuple()

        # Execute SQL function
        result = cast(
            GetHomeOverviewNewSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        # Set audit context
        if result.actor_name:
            audit_set(
                http_request, actor={"name": result.actor_name, "id": profile_id}
            )

        # Convert to API response
        api_response = GetHomeOverviewNewApiResponse.model_validate(result.model_dump())

        # Cache response
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
            operation="home_new_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
