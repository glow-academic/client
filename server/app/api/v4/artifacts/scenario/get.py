"""Scenario get endpoint - v4 API following DHH principles.
Unified endpoint that handles both new (scenario_id = NULL) and detail (scenario_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetScenarioApiRequest, GetScenarioApiResponse,
                           GetScenarioSqlParams, GetScenarioSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/scenarios/get_scenario_complete.sql"


router = APIRouter()


@router.post(
    "/get",
    response_model=GetScenarioApiResponse,
    dependencies=[
        audit_activity(
            "scenario.get",
            "{{ actor.name }} {% if scenario %}viewed{% else %}opened new{% endif %} scenario{% if scenario %} '{{ scenario.name }}'{% endif %}",
        )
    ],
)
async def get_scenario(
    request: GetScenarioApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetScenarioApiResponse:
    """Get scenario information - handles both new (scenario_id = NULL) and detail (scenario_id provided).
    
    Validation Logic:
    - New mode: Check for valid departments
    - Detail mode: Check scenario_exists and access
    """
    tags = ["scenarios"]  # From router tags

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
            return GetScenarioApiResponse.model_validate(cached["data"])

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

        # Get mcp flag from header (set by router-level dependency)
        mcp = getattr(http_request.state, "mcp", False) or False

        # Convert API request to SQL params (double star pattern)
        # Add profile_id and mcp from header; SQL signature is the source of truth
        request_dict = request.model_dump()
        request_dict["profile_id"] = profile_id
        request_dict["mcp"] = mcp
        params = GetScenarioSqlParams(**request_dict)
        sql_params = params.to_tuple()
        scenario_id = request.scenario_id  # Used for audit/context decisions

        # Execute SQL with typed helper
        result = cast(
            GetScenarioSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        scenario_name = (
            result.name_resource.name if result.name_resource else None
        )

        if result.actor_name:
            audit_ctx = {"actor": {"name": result.actor_name, "id": profile_id}}
            # Only add scenario to audit context if scenario_id was provided (detail mode)
            if scenario_id and scenario_name:
                audit_ctx["scenario"] = {
                    "name": scenario_name,
                    "id": str(scenario_id),
                }
            audit_set(http_request, **audit_ctx)

        # Conditional validation based on mode
        if scenario_id is None:
            # New mode: check for valid departments (derive from departments array)
            departments_list = result.departments or []
            valid_department_ids = [
                d.department_id for d in departments_list if d.department_id
            ]
            if not valid_department_ids:
                raise HTTPException(
                    status_code=400, detail="No accessible departments found for user"
                )
        else:
            # Detail mode: check if scenario exists and has access
            if result.scenario_exists is False:
                raise HTTPException(
                    status_code=404, detail=f"Scenario {scenario_id} not found"
                )

            if not scenario_name:
                # Scenario exists but user doesn't have access
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this scenario. It may be restricted to other departments.",
                )

        # Convert SQL result to API response
        response_data = GetScenarioApiResponse.model_validate(
            {
                **result.model_dump(),
            }
        )

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump(mode="json")},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_scenario",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
