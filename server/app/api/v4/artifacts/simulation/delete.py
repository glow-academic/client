"""Simulation delete endpoint - v4 API following DHH principles.

Uses two-pass architecture with Python-computed permissions.
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.simulation.permissions import (
    compute_can_delete,
    has_access,
)
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    CheckSimulationDeleteAccessSqlParams,
    CheckSimulationDeleteAccessSqlRow,
    DeleteSimulationApiRequest,
    DeleteSimulationApiResponse,
    DeleteSimulationSqlParams,
    DeleteSimulationSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/sql/v4/queries/simulations/delete_simulation_complete.sql"
ACCESS_SQL_PATH = (
    "app/sql/v4/queries/simulations/check_simulation_delete_access_complete.sql"
)


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteSimulationApiResponse,
    dependencies=[
        audit_activity(
            "simulation.deleted",
            "{{ actor.name }} deleted simulation '{{ simulation.name }}'",
        )
    ],
)
async def delete_simulation(
    request: DeleteSimulationApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteSimulationApiResponse:
    """Delete a simulation (with usage check).

    Uses two-pass architecture:
    1. Check access and permissions in Python
    2. Execute delete if permitted
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

        # Fetch user context for audit logging (lazy import to avoid circular deps)
        from app.api.v4.auth.profile import get_auth_profile_internal

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
        else:
            actor_name = None
            user_role = None

        # Pass 1: Check access using access query
        access_params = CheckSimulationDeleteAccessSqlParams(
            profile_id=profile_id,
            simulation_id=request.simulation_id,
        )
        access_result = cast(
            CheckSimulationDeleteAccessSqlRow,
            await execute_sql_typed(conn, ACCESS_SQL_PATH, params=access_params),
        )

        if access_result:
            # Extract permission context
            user_department_ids = (
                getattr(access_result, "user_department_ids", None) or []
            )
            simulation_department_ids = (
                getattr(access_result, "simulation_department_ids", None) or []
            )
            cohort_usage_count = getattr(access_result, "cohort_usage_count", 0) or 0
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

            # Check delete permission using Python
            if not compute_can_delete(
                user_role, simulation_department_ids, cohort_usage_count
            ):
                if cohort_usage_count > 0:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot delete simulation: in use by {cohort_usage_count} cohort(s)",
                    )
                else:
                    raise HTTPException(
                        status_code=403,
                        detail="You don't have permission to delete this simulation.",
                    )

        # Pass 2: Execute delete (inside transaction)
        async with conn.transaction():
            # Convert API request to SQL params (add profile_id from header)
            params = DeleteSimulationSqlParams(
                **request.model_dump(), profile_id=profile_id
            )
            sql_params = params.to_tuple()

            # Execute query with typed helper
            result = cast(
                DeleteSimulationSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result:
                # Simulation doesn't exist
                raise HTTPException(
                    status_code=404,
                    detail=f"Simulation {request.simulation_id} not found",
                )

            # Check if simulation was deleted or is in use
            if not result.deleted:
                # Simulation exists but is in use
                usage_count = result.usage_count or 0
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot delete simulation: in use by {usage_count} cohort(s)",
                )

            simulation_name = result.title or "Unknown"

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    simulation={
                        "name": simulation_name,
                        "id": str(request.simulation_id),
                    },
                )

        # Convert SQL result to API response
        api_response = DeleteSimulationApiResponse.model_validate(result.model_dump())

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
            operation="delete_simulation",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
