"""Scenario save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (input_scenario_id = NULL) and update (input_scenario_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

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

        # Fetch user context for audit logging
        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                profile_ctx = await get_auth_profile_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    bypass_cache=False,
                )
                actor_name = profile_ctx.access.actor_name
        else:
            actor_name = None

        # Resolve group_id server-side via access check
        group_id = None
        if pool:
            async with pool.acquire() as access_conn:
                access_params = GetScenarioAccessSqlParams(
                    profile_id=profile_id,
                    scenario_id=request.input_scenario_id,
                    draft_id=None,
                )
                access_result = cast(
                    GetScenarioAccessSqlRow,
                    await execute_sql_typed(
                        access_conn, ACCESS_SQL_PATH, params=access_params
                    ),
                )
                group_id = getattr(access_result, "group_id", None)

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
