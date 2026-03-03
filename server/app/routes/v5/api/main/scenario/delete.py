"""Scenario delete endpoint - v4 API following DHH principles."""

from typing import Annotated, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.main.scenario.permissions import (
    compute_can_delete,
    has_access,
)
from app.routes.v5.api.main.scenario.types import (
    DeleteScenarioApiRequest,
    DeleteScenarioApiResponse,
    DeleteScenarioResult,
)
from app.routes.auth.profile import get_auth_profile_internal
from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import get_db, get_pool
from app.sql.types import (
    CheckScenarioDeleteAccessSqlParams,
    CheckScenarioDeleteAccessSqlRow,
    DeleteScenarioSqlParams,
    DeleteScenarioSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/queries/scenario/check_scenario_delete_access_complete.sql"
)
DELETE_SQL_PATH = "app/sql/queries/scenario/delete_scenario_complete.sql"

router = APIRouter()


@router.post("/delete", response_model=DeleteScenarioApiResponse)
async def delete_scenario(
    request: DeleteScenarioApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteScenarioApiResponse:
    """Bulk delete scenarios — all-or-nothing single transaction."""
    tags = ["scenarios"]

    sql_query = load_sql_query(DELETE_SQL_PATH)

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

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
                user_department_ids = [
                    d.department_id for d in profile_ctx.departments if d.department_id
                ]
        else:
            actor_name = None
            user_role = None
            user_department_ids = []

        # Phase 1: Per-item access + permission checks (outside transaction, fail fast)
        for idx, scenario_id in enumerate(request.scenario_ids):
            access_params = CheckScenarioDeleteAccessSqlParams(
                profile_id=profile_id,
                scenario_id=scenario_id,
            )
            access_result = cast(
                CheckScenarioDeleteAccessSqlRow,
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

            if not access_result.scenario_exists:
                raise HTTPException(
                    status_code=404,
                    detail=f"Item {idx}: Scenario not found: {scenario_id}",
                )

            scenario_department_ids = access_result.scenario_department_ids or []

            if not has_access(user_role, user_department_ids, scenario_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have access to this scenario.",
                )

            usage_count = access_result.usage_count or 0
            if not compute_can_delete(user_role, scenario_department_ids, usage_count):
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have permission to delete this scenario.",
                )

        # Phase 2: Single transaction — execute delete SQL for each item
        results: list[DeleteScenarioResult] = []

        async with conn.transaction():
            for idx, scenario_id in enumerate(request.scenario_ids):
                params = DeleteScenarioSqlParams(
                    scenario_id=scenario_id, profile_id=profile_id
                )

                result = cast(
                    DeleteScenarioSqlRow,
                    await execute_sql_typed(
                        conn,
                        DELETE_SQL_PATH,
                        params=params,
                    ),
                )

                if not result:
                    raise ValueError(f"Item {idx}: Failed to delete scenario")

                if not result.deleted:
                    raise ValueError(f"Item {idx}: Scenario not found: {scenario_id}")

                scenario_name = result.name or "Unknown"
                results.append(
                    DeleteScenarioResult(
                        success=True,
                        scenario_id=scenario_id,
                        message=f"Scenario '{scenario_name}' deleted successfully",
                    )
                )

        # Audit context
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return DeleteScenarioApiResponse(results=results)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_scenario",
            sql_query=sql_query,
            sql_params=None,
            request=http_request,
        )
