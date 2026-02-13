"""Simulation save endpoint - v4 API following DHH principles.

Unified endpoint that handles both create (input_simulation_id = NULL) and update (input_simulation_id provided).
Uses two-pass architecture with Python-computed permissions.
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.simulation.permissions import (
    compute_can_create,
    compute_can_save,
    has_access,
)
from app.api.v4.artifacts.simulation.types import (
    SaveSimulationApiRequest,
    SaveSimulationApiResponse,
    SaveSimulationSqlParams,
    SaveSimulationSqlRow,
)
from app.api.v4.auth.context import get_profile_context_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    CheckSimulationSaveAccessSqlParams,
    CheckSimulationSaveAccessSqlRow,
    GetNameByIdSqlParams,
    GetNameByIdSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/simulations/save_simulation_complete.sql"
GET_NAME_SQL_PATH = "app/sql/v4/queries/simulations/get_name_by_id_complete.sql"
ACCESS_SQL_PATH = (
    "app/sql/v4/queries/simulations/check_simulation_save_access_complete.sql"
)


router = APIRouter()


@router.post(
    "/save",
    response_model=SaveSimulationApiResponse,
    dependencies=[
        audit_activity(
            "simulation.saved",
            "{{ actor.name }} {% if simulation %}updated{% else %}created{% endif %} simulation{% if simulation %} '{{ simulation.name }}'{% endif %}",
        )
    ],
)
async def save_simulation(
    request: SaveSimulationApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveSimulationApiResponse:
    """Save simulation - handles both create (input_simulation_id = NULL) and update (input_simulation_id provided).

    Uses two-pass architecture:
    1. Check access and permissions in Python
    2. Execute save if permitted
    """
    tags = ["simulations"]  # From router tags

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
                resolved_context = await get_profile_context_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    bypass_cache=False,
                )
                actor_name = resolved_context.actor_name
                user_role = resolved_context.user_role
                user_department_ids = [
                    d.department_id
                    for d in resolved_context.departments
                    if d.department_id
                ]
        else:
            actor_name = None
            user_role = None
            user_department_ids = []

        # Pass 1: Check access using typed access query
        access_params = CheckSimulationSaveAccessSqlParams(
            profile_id=profile_id,
            simulation_id=request.input_simulation_id,
            draft_id=None,  # Not using draft_id - passing explicit values directly
        )

        access_result = cast(
            CheckSimulationSaveAccessSqlRow,
            await execute_sql_typed(
                conn,
                ACCESS_SQL_PATH,
                params=access_params,
            ),
        )

        if access_result:
            # user_role and user_department_ids already fetched from context above
            simulation_department_ids = (
                getattr(access_result, "simulation_department_ids", None) or []
            )
            cohort_usage_count = getattr(access_result, "cohort_usage_count", 0) or 0
            simulation_exists = getattr(access_result, "simulation_exists", None)

            if request.input_simulation_id:
                # Update mode
                # Check if simulation exists
                if simulation_exists is False:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Simulation {request.input_simulation_id} not found",
                    )

                # Check access permission
                if not has_access(
                    user_role, user_department_ids, simulation_department_ids
                ):
                    raise HTTPException(
                        status_code=403,
                        detail="You don't have access to this simulation.",
                    )

                # Check save permission using Python
                if not compute_can_save(
                    user_role,
                    user_department_ids,
                    simulation_department_ids,
                    cohort_usage_count,
                ):
                    if cohort_usage_count > 0 and user_role == "staff":
                        raise HTTPException(
                            status_code=403,
                            detail=f"Simulation is used by {cohort_usage_count} cohort(s). Only admins can edit.",
                        )
                    else:
                        raise HTTPException(
                            status_code=403,
                            detail="You don't have permission to save this simulation.",
                        )
            else:
                # Create mode
                # Use department_ids from request resource actions
                request_department_ids = (
                    [str(d) for d in (request.departments.resource_ids or [])]
                    if request.departments.resource_ids
                    else []
                )
                if not compute_can_create(user_role, request_department_ids):
                    raise HTTPException(
                        status_code=403,
                        detail="You don't have permission to create simulations.",
                    )

        # Pass 2: Execute save
        async with conn.transaction():
            # Convert nested resource actions to SQL params
            params = SaveSimulationSqlParams.from_request(
                request, profile_id=profile_id
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                SaveSimulationSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.simulation_id:
                if request.input_simulation_id:
                    raise ValueError(
                        f"Simulation not found: {request.input_simulation_id}"
                    )
                else:
                    raise ValueError("Failed to create simulation")

            # Set audit context with data from SQL query
            if actor_name:
                audit_ctx = {"actor": {"name": actor_name, "id": profile_id}}
                # Only add simulation to audit context if input_simulation_id was provided (update mode)
                # For create mode, we don't have the name yet, so we'll use a placeholder
                if request.input_simulation_id:
                    # Update mode: look up name from name_id if available
                    simulation_name = "Simulation"
                    if request.names and request.names.resource_id:
                        name_params = GetNameByIdSqlParams(
                            name_id=request.names.resource_id
                        )
                        name_result = cast(
                            GetNameByIdSqlRow,
                            await execute_sql_typed(
                                conn, GET_NAME_SQL_PATH, params=name_params
                            ),
                        )
                        if name_result and name_result.name:
                            simulation_name = name_result.name
                    audit_ctx["simulation"] = {
                        "name": simulation_name,
                        "id": str(result.simulation_id),
                    }
                audit_set(http_request, **audit_ctx)

        # Convert SQL result to API response
        api_response = SaveSimulationApiResponse.model_validate(
            {
                "simulation_id": str(result.simulation_id),
                "actor_name": actor_name,
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
            operation="save_simulation",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
