"""Scenario duplicate endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.scenario.permissions import (
    compute_can_duplicate,
    has_access,
)
from app.api.v4.artifacts.scenario.types import (
    DuplicateScenarioApiRequest,
    DuplicateScenarioApiResponse,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.infra.v4.activity.audit import audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    CheckScenarioDuplicateAccessSqlParams,
    CheckScenarioDuplicateAccessSqlRow,
    DuplicateScenarioSqlParams,
    DuplicateScenarioSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/scenario/duplicate_scenario_complete.sql"
ACCESS_SQL_PATH = (
    "app/sql/v4/queries/scenario/check_scenario_duplicate_access_complete.sql"
)


router = APIRouter()


@router.post(
    "/duplicate",
    response_model=DuplicateScenarioApiResponse,
)
async def duplicate_scenario(
    request: DuplicateScenarioApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateScenarioApiResponse:
    """Duplicate a scenario."""
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
                    d.department_id
                    for d in profile_ctx.departments
                    if d.department_id
                ]
        else:
            actor_name = None
            user_role = None
            user_department_ids = []

        # Permission check
        access_params = CheckScenarioDuplicateAccessSqlParams(
            profile_id=profile_id,
            scenario_id=request.scenario_id,
        )
        access_result = cast(
            CheckScenarioDuplicateAccessSqlRow,
            await execute_sql_typed(
                conn,
                ACCESS_SQL_PATH,
                params=access_params,
            ),
        )

        if not access_result:
            raise HTTPException(
                status_code=401,
                detail="Unable to verify user permissions.",
            )

        if not access_result.scenario_exists:
            raise HTTPException(
                status_code=404,
                detail=f"Scenario not found: {request.scenario_id}",
            )

        if not has_access(
            user_role,
            user_department_ids,
            access_result.scenario_department_ids or [],
        ):
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this scenario.",
            )

        if not compute_can_duplicate(user_role):
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to duplicate scenarios.",
            )

        # Convert API request to SQL params (add profile_id from header)
        params = DuplicateScenarioSqlParams(
            **request.model_dump(), profile_id=profile_id
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper (single row result)
        result = cast(
            DuplicateScenarioSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        if not result.scenario_id:
            raise ValueError(f"Scenario not found: {request.scenario_id}")

        scenario_name = result.scenario_name or "Unknown"

        # Set audit context with data from SQL query
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                scenario={"name": scenario_name, "id": str(result.scenario_id)},
            )

        # Convert SQL result to API response
        api_response = DuplicateScenarioApiResponse.model_validate(result.model_dump())

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="duplicate_scenario",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
