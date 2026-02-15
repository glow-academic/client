"""Scenario save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (input_scenario_id = NULL) and update (input_scenario_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.scenario.permissions import (
    compute_can_create,
    compute_can_edit,
)
from app.api.v4.artifacts.scenario.types import (
    SaveScenarioApiRequest,
    SaveScenarioApiResponse,
    SaveScenarioSqlParams,
    SaveScenarioSqlRow,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetScenarioAccessSqlParams,
    GetScenarioAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/scenarios/save_scenario_complete.sql"
ACCESS_SQL_PATH = "app/sql/v4/queries/scenarios/get_scenario_access_complete.sql"


router = APIRouter()


@router.post(
    "/save",
    response_model=SaveScenarioApiResponse,
    dependencies=[
        audit_activity(
            "scenario.saved",
            "{{ actor.name }} {% if scenario %}updated{% else %}created{% endif %} scenario{% if scenario %} '{{ scenario.name }}'{% endif %}",
        )
    ],
)
async def save_scenario(
    request: SaveScenarioApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveScenarioApiResponse:
    """Save scenario - handles both create (input_scenario_id = NULL) and update (input_scenario_id provided)."""
    tags = ["scenarios"]  # From router tags

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

        # Fetch user context for permissions and audit logging
        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                profile_ctx = await get_auth_profile_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    bypass_cache=False,
                )
                actor_name = profile_ctx.access.actor_name
                user_role = profile_ctx.access.role
                user_department_ids = [
                    d.department_id for d in profile_ctx.departments if d.department_id
                ]
        else:
            actor_name = None
            user_role = None
            user_department_ids = []

        # Create group_id in Python (moved from SQL)
        group_id = None
        if pool:
            async with pool.acquire() as group_conn:
                group_id = await group_conn.fetchval(
                    "INSERT INTO groups_entry (created_at, updated_at) VALUES (NOW(), NOW()) RETURNING id"
                )

        # Permission checks
        if request.input_scenario_id:
            # Update mode: check access and save permissions
            access_params = GetScenarioAccessSqlParams(
                profile_id=profile_id,
                scenario_id=request.input_scenario_id,
                draft_id=None,
            )
            access_result = cast(
                GetScenarioAccessSqlRow,
                await execute_sql_typed(conn, ACCESS_SQL_PATH, params=access_params),
            )
            if access_result and access_result.scenario_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Scenario {request.input_scenario_id} not found",
                )
            if not compute_can_edit(
                user_role=user_role,
                scenario_department_ids=getattr(access_result, "scenario_department_ids", None) or [],
                active_simulation_count=getattr(access_result, "active_simulation_count", 0),
                user_department_ids=user_department_ids,
            ):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have permission to save this scenario.",
                )
        else:
            # Create mode: check create permissions
            if not compute_can_create(user_role, user_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have permission to create scenarios.",
                )

        async with conn.transaction():
            # Convert API request to SQL params (add profile_id and server-resolved group_id)
            params = SaveScenarioSqlParams.from_request(
                request, profile_id=profile_id, group_id=group_id
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                SaveScenarioSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.scenario_id:
                if request.input_scenario_id:
                    raise ValueError(f"Scenario not found: {request.input_scenario_id}")
                else:
                    raise ValueError("Failed to create scenario")

            # Set audit context with data from SQL query
            if actor_name:
                audit_ctx = {"actor": {"name": actor_name, "id": profile_id}}
                if request.input_scenario_id:
                    audit_ctx["scenario"] = {
                        "name": getattr(request, "name", "Scenario"),
                        "id": str(result.scenario_id),
                    }
                else:
                    audit_ctx["scenario"] = {
                        "name": getattr(request, "name", "Scenario"),
                        "id": str(result.scenario_id),
                    }
                audit_set(http_request, **audit_ctx)

        # Convert SQL result to API response
        is_update = request.input_scenario_id is not None
        api_response = SaveScenarioApiResponse.model_validate(
            {
                "success": True,
                "scenario_id": str(result.scenario_id),
                "message": "Scenario updated successfully"
                if is_update
                else "Scenario created successfully",
            }
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="save_scenario",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
