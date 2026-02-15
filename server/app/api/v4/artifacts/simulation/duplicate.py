"""Simulation duplicate endpoint - v4 API following DHH principles.

Uses two-pass architecture with Python-computed permissions.
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.simulation.permissions import (
    compute_can_duplicate,
    has_access,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.resources.names.create import create_names_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    CheckSimulationDuplicateAccessSqlParams,
    CheckSimulationDuplicateAccessSqlRow,
    DuplicateSimulationApiRequest,
    DuplicateSimulationApiResponse,
    DuplicateSimulationSqlParams,
    DuplicateSimulationSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/sql/v4/queries/simulations/duplicate_simulation_complete.sql"
ACCESS_SQL_PATH = (
    "app/sql/v4/queries/simulations/check_simulation_duplicate_access_complete.sql"
)


router = APIRouter()


@router.post(
    "/duplicate",
    response_model=DuplicateSimulationApiResponse,
    dependencies=[
        audit_activity(
            "simulation.duplicated",
            "{{ actor.name }} duplicated simulation '{{ simulation.name }}'",
        )
    ],
)
async def duplicate_simulation(
    request: DuplicateSimulationApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateSimulationApiResponse:
    """Duplicate a simulation.

    Uses two-pass architecture:
    1. Check access and permissions in Python
    2. Execute duplicate if permitted
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

        # Pass 1: Check access using access query
        access_params = CheckSimulationDuplicateAccessSqlParams(
            profile_id=profile_id,
            simulation_id=request.simulation_id,
        )
        access_result = cast(
            CheckSimulationDuplicateAccessSqlRow,
            await execute_sql_typed(conn, ACCESS_SQL_PATH, params=access_params),
        )

        if access_result:
            # Extract permission context
            user_role = getattr(access_result, "user_role", None)
            user_department_ids = (
                getattr(access_result, "user_department_ids", None) or []
            )
            simulation_department_ids = (
                getattr(access_result, "simulation_department_ids", None) or []
            )
            simulation_exists = getattr(access_result, "simulation_exists", False)

            # Check if simulation exists
            if not simulation_exists:
                raise HTTPException(
                    status_code=404,
                    detail=f"Simulation {request.simulation_id} not found",
                )

            # Check access permission
            if not has_access(
                user_role, user_department_ids, simulation_department_ids
            ):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this simulation.",
                )

            # Check duplicate permission using Python
            if not compute_can_duplicate(user_role):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have permission to duplicate simulations.",
                )

        # Phase 1: Python creates name resource
        original_name = getattr(access_result, "simulation_name", None) or "Unknown"
        new_name = f"{original_name} Copy"
        name_resource_id = await create_names_internal(conn, new_name)

        # Phase 2: SQL creates artifact + links junctions (inside transaction)
        async with conn.transaction():
            params = DuplicateSimulationSqlParams(
                simulation_id=request.simulation_id,
                profile_id=profile_id,
                name_resource_id=name_resource_id,
            )
            sql_params = params.to_tuple()

            # Execute query with typed helper
            result = cast(
                DuplicateSimulationSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.simulation_id:
                raise HTTPException(
                    status_code=404,
                    detail=f"Simulation {request.simulation_id} not found",
                )

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    simulation={
                        "name": original_name,
                        "id": str(request.simulation_id),
                    },
                )

        # Convert SQL result to API response
        api_response = DuplicateSimulationApiResponse.model_validate(
            result.model_dump()
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="duplicate_simulation",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
