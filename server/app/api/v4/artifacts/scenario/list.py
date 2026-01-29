"""Scenarios list endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.scenario.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.api.v4.artifacts.scenario.types import (
    GetScenariosListApiRequest,
    GetScenariosListSqlParams,
    ListScenarioApiResponse,
    ListScenarioSqlRow,
)
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import load_sql_query
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/scenario/get_scenarios_list_complete.sql"


router = APIRouter()


@router.post(
    "/list",
    response_model=ListScenarioApiResponse,
    dependencies=[
        audit_activity("scenarios.list", "{{ actor.name }} visited the Scenarios page")
    ],
)
async def get_scenario_list(
    request: GetScenariosListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListScenarioApiResponse:
    """Get scenarios list with all relationships."""
    tags = ["scenarios"]  # From router tags

    # Check for cache bypass header (for testing)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body (mode='json' to serialize UUIDs)
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return ListScenarioApiResponse.model_validate(cached["data"])

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
        params = GetScenariosListSqlParams(
            **request.model_dump(), profile_id=profile_id
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper - automatically detects and calls function if present
        result = cast(
            ListScenarioSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        # Compute permissions in Python for each scenario
        user_role = result.user_role
        scenarios_with_permissions = []
        for scenario in result.scenarios or []:
            scenario_dict = (
                scenario.model_dump()
                if hasattr(scenario, "model_dump")
                else dict(scenario)
            )
            # num_simulations = count of simulations using this scenario
            usage_count = scenario_dict.get("num_simulations") or 0
            department_ids_raw = scenario_dict.get("department_ids") or []
            department_ids = [
                UUID(d) if isinstance(d, str) else d for d in department_ids_raw
            ]
            scenario_dict["can_edit"] = compute_can_edit(
                user_role, department_ids, usage_count
            )
            scenario_dict["can_delete"] = compute_can_delete(
                user_role, department_ids, usage_count
            )
            scenario_dict["can_duplicate"] = compute_can_duplicate(user_role)
            scenarios_with_permissions.append(scenario_dict)

        result_dict = result.model_dump()
        result_dict["scenarios"] = scenarios_with_permissions

        # Convert SQL result to API response
        api_response = ListScenarioApiResponse.model_validate(result_dict)

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
            operation="get_scenario_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
