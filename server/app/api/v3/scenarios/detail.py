"""Scenario detail endpoint - v3 API following DHH principles."""

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
    GetScenarioDetailApiRequest,
    GetScenarioDetailApiResponse,
    GetScenarioDetailSqlParams,
    GetScenarioDetailSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/scenarios/get_scenario_detail_complete.sql"


router = APIRouter()


@router.post(
    "/detail",
    response_model=GetScenarioDetailApiResponse,
    dependencies=[
        audit_activity(
            "scenario.viewed", "{{ actor.name }} viewed scenario '{{ scenario.name }}'"
        )
    ],
)
async def get_scenario_detail(
    request: GetScenarioDetailApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetScenarioDetailApiResponse:
    """Get detailed scenario information."""
    tags = ["scenarios"]  # From router tags

    # Check for cache bypass header (for hard refresh)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return GetScenarioDetailApiResponse.model_validate(cached["data"])

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

        # Convert API request to SQL params (use double star pattern)
        # SQL handles None-to-empty conversions via COALESCE in params CTE
        params = GetScenarioDetailSqlParams(
            **request.model_dump(), profile_id=profile_id
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper - automatically detects and calls function if present
        result = cast(
            GetScenarioDetailSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Check if scenario exists and has access using SQL result
        if not result.scenario_exists:
            raise HTTPException(
                status_code=404, detail=f"Scenario {request.scenario_id} not found"
            )

        if not result.scenario_id:
            # Scenario exists but user doesn't have access
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this scenario. It may be restricted to other departments.",
            )

        # Set audit context with data from SQL query
        if result.actor_name:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": profile_id},
                scenario={"name": result.name or "", "id": str(result.scenario_id)},
            )

        # Convert SQL result to API response
        api_response = GetScenarioDetailApiResponse.model_validate(result.model_dump())

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
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_scenario_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
