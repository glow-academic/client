"""Cohort search-profile endpoint - search profiles for adding to a cohort."""

import uuid
from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetCohortSearchApiRequest,
    GetCohortSearchApiResponse,
    GetCohortSearchSqlParams,
    GetCohortSearchSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/cohorts/get_cohort_search_complete.sql"


router = APIRouter()


@router.post(
    "/search",
    response_model=GetCohortSearchApiResponse,
    dependencies=[
        audit_activity("cohorts.searched", "{{ actor.name }} searched cohorts")
    ],
)
async def cohort_search_profile(
    request: GetCohortSearchApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetCohortSearchApiResponse:
    """Search profiles for adding to a cohort (excludes profiles already in cohort if cohortId provided)."""
    tags = ["cohorts"]  # From router tags

    # Generate cache key from path and parsed body (use mode='json' to serialize UUIDs)
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetCohortSearchApiResponse.model_validate(cached["data"])

    sql_query = load_sql_query(SQL_PATH)
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
        params = GetCohortSearchSqlParams(
            p_profile_id=uuid.UUID(profile_id),
            p_cohort_id=request.p_cohort_id if request.p_cohort_id else None,
            p_query=request.p_query,
            p_dept_ids=request.p_dept_ids or [],
            p_limit_count=request.p_limit_count or 200,
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper - automatically detects and calls function if present
        result = cast(
            GetCohortSearchSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        # Convert SQL result to API response (no manual conversion needed - SQL returns arrays)
        api_response = GetCohortSearchApiResponse.model_validate(result.model_dump())

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=60,
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
            operation="cohort_search_profile",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
