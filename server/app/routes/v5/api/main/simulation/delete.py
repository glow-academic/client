"""Simulation delete endpoint - v4 API following DHH principles."""

from typing import Annotated, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.main.simulation.permissions import compute_can_delete
from app.routes.v5.api.main.simulation.types import (
    DeleteSimulationApiRequest,
    DeleteSimulationApiResponse,
    DeleteSimulationResult,
)
from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import get_db, get_pool
from app.sql.types import (
    CheckSimulationDeleteAccessSqlParams,
    CheckSimulationDeleteAccessSqlRow,
    DeleteSimulationSqlParams,
    DeleteSimulationSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/queries/simulations/check_simulation_delete_access_complete.sql"
)
DELETE_SQL_PATH = "app/sql/queries/simulations/delete_simulation_complete.sql"

router = APIRouter()


@router.post("/delete", response_model=DeleteSimulationApiResponse)
async def delete_simulation(
    request: DeleteSimulationApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteSimulationApiResponse:
    """Bulk delete simulations — all-or-nothing single transaction."""
    tags = ["simulations"]

    sql_query = load_sql_query(DELETE_SQL_PATH)

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Lazy import to avoid circular import chain
        from app.routes.auth.profile import get_auth_profile_internal

        # Fetch user context once for the whole batch
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

        # Phase 1: Per-item access + permission checks (outside transaction, fail fast)
        for idx, simulation_id in enumerate(request.simulation_ids):
            access_params = CheckSimulationDeleteAccessSqlParams(
                profile_id=profile_id,
                simulation_id=simulation_id,
            )
            access_result = cast(
                CheckSimulationDeleteAccessSqlRow,
                await execute_sql_typed(
                    conn,
                    ACCESS_CHECK_SQL_PATH,
                    params=access_params,
                ),
            )

            if not access_result:
                raise HTTPException(
                    status_code=401,
                    detail=f"Item {idx}: Unable to verify user permissions.",
                )

            simulation_department_ids = (
                getattr(access_result, "simulation_department_ids", None) or []
            )
            cohort_usage_count = getattr(access_result, "cohort_usage_count", 0) or 0

            can_delete = compute_can_delete(
                user_role=user_role,
                simulation_department_ids=simulation_department_ids,
                cohort_usage_count=cohort_usage_count,
            )

            if not can_delete:
                if cohort_usage_count > 0:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Item {idx}: Cannot delete simulation: in use by {cohort_usage_count} cohort(s)",
                    )
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have permission to delete this simulation.",
                )

        # Phase 2: Single transaction — execute delete SQL for each item
        results: list[DeleteSimulationResult] = []

        async with conn.transaction():
            for idx, simulation_id in enumerate(request.simulation_ids):
                params = DeleteSimulationSqlParams(
                    simulation_id=simulation_id, profile_id=profile_id
                )

                result = cast(
                    DeleteSimulationSqlRow,
                    await execute_sql_typed(
                        conn,
                        DELETE_SQL_PATH,
                        params=params,
                    ),
                )

                if not result:
                    raise ValueError(f"Item {idx}: Failed to check simulation usage")

                usage_count = result.usage_count or 0
                if usage_count > 0:
                    raise ValueError(
                        f"Item {idx}: Cannot delete simulation that is in use by {usage_count} cohort(s)"
                    )

                if not result.deleted:
                    raise ValueError(
                        f"Item {idx}: Simulation not found: {simulation_id}"
                    )

                simulation_name = result.title or "Unknown"
                results.append(
                    DeleteSimulationResult(
                        success=True,
                        simulation_id=simulation_id,
                        message=f"Simulation '{simulation_name}' deleted successfully",
                    )
                )

        # Audit context
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return DeleteSimulationApiResponse(results=results)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_simulation",
            sql_query=sql_query,
            sql_params=None,
            request=http_request,
        )
