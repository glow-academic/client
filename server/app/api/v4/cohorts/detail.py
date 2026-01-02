"""Cohort detail endpoint - v4 API."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetCohortDetailApiRequest,
    GetCohortDetailApiResponse,
    GetCohortDetailSqlParams,
    GetCohortDetailSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/cohorts/get_cohort_detail_complete.sql"


router = APIRouter()


@router.post(
    "/detail",
    response_model=GetCohortDetailApiResponse,
    dependencies=[
        audit_activity(
            "cohort.viewed", "{{ actor.name }} viewed cohort '{{ cohort.name }}'"
        )
    ],
)
async def get_cohort_detail(
    request: GetCohortDetailApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetCohortDetailApiResponse:
    """Get cohort detail with staff, simulations, and mappings."""
    tags = ["cohorts"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetCohortDetailApiResponse.model_validate(cached["data"])

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

        # Extract filter params from API request
        simulation_search = request.simulation_search
        simulation_show_selected = request.simulation_show_selected
        current_simulation_ids = request.current_simulation_ids

        # Convert API request to SQL params (add profile_id from header)
        params = GetCohortDetailSqlParams(
            cohort_id=request.cohort_id,
            profile_id=profile_id,
            draft_id=request.draft_id,
            simulation_search=simulation_search,
            simulation_show_selected=simulation_show_selected,
            current_simulation_ids=current_simulation_ids
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper - automatically detects and calls function if present
        result = cast(
            GetCohortDetailSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Check if cohort exists and has access using SQL result
        # SQL now returns cohort_exists field to distinguish 404 vs 403
        if not result.cohort_exists:
            raise HTTPException(
                status_code=404, detail=f"Cohort {request.cohort_id} not found"
            )

        if not result.title:
            # Cohort exists but user doesn't have access
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this cohort. It may be restricted to other departments.",
            )

        # Set audit context with data from SQL query
        actor_name = result.actor_name
        cohort_name = result.title
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                cohort={"name": cohort_name, "id": str(request.cohort_id)},
            )

        # Convert SQL result to API response (no manual conversion needed - SQL returns arrays)
        api_response = GetCohortDetailApiResponse.model_validate(result.model_dump())

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
            operation="get_cohort_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
