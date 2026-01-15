"""Reports get v4 API endpoint - unified overview and history for individual profile."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetReportsHistoryApiRequest,
                           GetReportsHistoryApiResponse,
                           GetReportsHistorySqlParams, GetReportsHistorySqlRow,
                           GetReportsOverviewApiRequest,
                           GetReportsOverviewApiResponse,
                           GetReportsOverviewSqlParams,
                           GetReportsOverviewSqlRow, load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
OVERVIEW_SQL_PATH = "app/sql/v4/reports/get_reports_overview_complete.sql"
HISTORY_SQL_PATH = "app/sql/v4/reports/get_reports_history_complete.sql"

router = APIRouter()


@router.post(
    "/get",
    response_model=GetReportsOverviewApiResponse,
    dependencies=[
        audit_activity("reports.get", "{{ actor.name }} viewed reports")
    ],
)
async def get_reports(
    request: GetReportsOverviewApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetReportsOverviewApiResponse:
    """Get complete reports overview bundle with history for individual profile - requires profileId."""
    tags = ["reports"]

    # Check for cache bypass header (for hard refresh)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body (use mode='json' for consistent serialization)
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return GetReportsOverviewApiResponse.model_validate(cached["data"])

    sql_query = load_sql_query(OVERVIEW_SQL_PATH)
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
        # Note: request fields are snake_case (start_date, end_date, etc.)
        # SQL handles date conversion from text to timestamptz - no manual parsing needed
        overview_params = GetReportsOverviewSqlParams(
            **request.model_dump(), profile_id=profile_id
        )
        sql_params = overview_params.to_tuple()

        # Disable JIT compilation for this complex query to avoid re-compilation overhead
        async with conn.transaction():
            await conn.execute("SET LOCAL jit = off;")
            # Execute overview query
            overview_result = cast(
                GetReportsOverviewSqlRow,
                await execute_sql_typed(
                    conn,
                    OVERVIEW_SQL_PATH,
                    params=overview_params,
                ),
            )
            
            # Execute history query to get history data (no pagination for single profile)
            # Use default pagination params to get all history
            history_request_dict = request.model_dump()
            history_request_dict.update({
                "page": 0,
                "page_size": 1000,  # Large page size to get all history for single profile
                "search": None,
                "profile_ids": [],
                "simulation_ids": [],
                "scenario_ids": [],
                "infinite_mode": None,
                "sort_by": "date",
                "sort_order": "desc",
            })
            history_params = GetReportsHistorySqlParams(
                **history_request_dict, profile_id=profile_id
            )
            history_result = cast(
                GetReportsHistorySqlRow,
                await execute_sql_typed(
                    conn,
                    HISTORY_SQL_PATH,
                    params=history_params,
                ),
            )

        # Set audit context using actor_name from SQL result
        if overview_result.actor_name:
            audit_set(http_request, actor={"name": overview_result.actor_name, "id": profile_id})

        # Merge history data into overview response
        # Convert overview result to dict, replace history with history data
        overview_dict = overview_result.model_dump()
        # Map history result data to overview history format (types are compatible)
        overview_dict["history"] = history_result.data

        # Convert merged result to API response
        api_response = GetReportsOverviewApiResponse.model_validate(overview_dict)

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
            operation="get_reports",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
