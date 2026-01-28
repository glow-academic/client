"""Simulation get endpoint - v4 API following DHH principles.

Unified endpoint that handles both new (simulation_id = NULL) and detail (simulation_id provided).
Uses two-pass architecture with Python-computed permissions.
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetSimulationApiRequest,
    GetSimulationApiResponse,
    GetSimulationSqlParams,
    GetSimulationSqlRow,
    load_sql_query,
)
from app.api.v4.artifacts.simulation.permissions import (
    has_access,
    compute_can_edit,
    compute_disabled_reason,
    compute_show_name,
    compute_show_description,
    compute_show_departments,
    compute_show_flag,
    compute_show_scenarios,
    compute_name_required,
    compute_description_required,
    compute_departments_required,
    compute_flag_required,
    compute_scenarios_required,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/simulations/get_simulation_complete.sql"


router = APIRouter()


@router.post(
    "/get",
    response_model=GetSimulationApiResponse,
    dependencies=[
        audit_activity(
            "simulation.get",
            "{{ actor.name }} {% if simulation %}viewed{% else %}opened new{% endif %} simulation{% if simulation %} '{{ simulation.name }}'{% endif %}",
        )
    ],
)
async def get_simulation(
    request: GetSimulationApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSimulationApiResponse:
    """Get simulation information - handles both new (simulation_id = NULL) and detail (simulation_id provided).

    Uses two-pass architecture:
    1. SQL fetches raw data and context
    2. Python computes permissions using permissions.py functions

    Validation Logic:
    - Tools are REQUIRED for resources - error if no tools exist (via missing_tools_check CTE)
    - Agents are OPTIONAL - NULL agent_id means manual entry only (no generate button shown)
    - Frontend components check agent_id before showing generate button
    """
    tags = ["simulations"]  # From router tags

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
            return GetSimulationApiResponse.model_validate(cached["data"])

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

        # Extract search and filter params from API request
        scenario_search = request.scenario_search
        scenario_show_selected = request.scenario_show_selected
        filter_scenario_ids = request.filter_scenario_ids
        draft_id = request.draft_id
        simulation_id = request.simulation_id  # Can be NULL for new mode

        # Get mcp flag from header (set by router-level dependency)
        mcp = getattr(http_request.state, "mcp", False) or False

        # Convert API request to SQL params (add profile_id and mcp from header)
        params = GetSimulationSqlParams(
            profile_id=profile_id,
            simulation_id=simulation_id,
            draft_id=draft_id,
            scenario_search=scenario_search,
            scenario_show_selected=scenario_show_selected,
            filter_scenario_ids=filter_scenario_ids,
            mcp=mcp,
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper
        result = cast(
            GetSimulationSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if result.actor_name:
            audit_ctx = {"actor": {"name": result.actor_name, "id": profile_id}}
            # Only add simulation to audit context if simulation_id was provided (detail mode)
            if simulation_id and result.name_resource and result.name_resource.name:
                audit_ctx["simulation"] = {
                    "name": result.name_resource.name,
                    "id": str(simulation_id),
                }
            audit_set(http_request, **audit_ctx)

        # Extract user context for Python permission computation
        user_role = getattr(result, "user_role", None)
        user_department_ids = getattr(result, "user_department_ids", None) or []
        simulation_department_ids = getattr(result, "simulation_department_ids", None) or []
        cohort_usage_count = getattr(result, "cohort_usage_count", 0) or 0

        # Conditional validation based on mode
        if simulation_id is None:
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
            # Detail mode: check if simulation exists and has access
            if result.simulation_exists is False:
                raise HTTPException(
                    status_code=404, detail=f"Simulation {simulation_id} not found"
                )

            # Check access using Python permissions
            if not has_access(user_role, user_department_ids, simulation_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this simulation. It may be restricted to other departments.",
                )

            if not result.name_resource or not result.name_resource.name:
                # Simulation exists but user doesn't have access
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this simulation. It may be restricted to other departments.",
                )

        # Compute permissions in Python using permissions.py
        can_edit = compute_can_edit(user_role, simulation_department_ids, cohort_usage_count)
        disabled_reason = compute_disabled_reason(user_role, simulation_department_ids, cohort_usage_count)

        # Get tools flags for show computation
        names_has_tools = getattr(result, "names_has_tools", True) or True
        departments_count = len(result.departments or [])
        scenarios_count = len(result.scenarios or [])

        # Compute show flags in Python
        show_name = compute_show_name(names_has_tools)
        show_description = compute_show_description()
        show_departments = compute_show_departments(departments_count)
        show_flag = compute_show_flag()
        show_scenarios = compute_show_scenarios(scenarios_count)

        # Compute required flags in Python
        name_required = compute_name_required()
        description_required = compute_description_required()
        departments_required = compute_departments_required()
        flag_required = compute_flag_required()
        scenarios_required = compute_scenarios_required()

        # Build response with Python-computed permissions
        result_dict = result.model_dump(mode="json")

        # Override SQL-computed permissions with Python-computed ones
        result_dict["can_edit"] = can_edit
        result_dict["disabled_reason"] = disabled_reason
        result_dict["show_name"] = show_name
        result_dict["show_description"] = show_description
        result_dict["show_departments"] = show_departments
        result_dict["show_flag"] = show_flag
        result_dict["show_scenarios"] = show_scenarios
        result_dict["name_required"] = name_required
        result_dict["description_required"] = description_required
        result_dict["departments_required"] = departments_required
        result_dict["flag_required"] = flag_required
        result_dict["scenarios_required"] = scenarios_required

        # Convert SQL result to API response
        response_data = GetSimulationApiResponse.model_validate(result_dict)

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
            operation="get_simulation",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
