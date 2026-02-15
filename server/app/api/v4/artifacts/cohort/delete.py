"""Cohort delete endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.cohort.permissions import (
    compute_can_delete,
    has_access,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    CheckCohortDeleteAccessSqlParams,
    CheckCohortDeleteAccessSqlRow,
    DeleteCohortApiRequest,
    DeleteCohortApiResponse,
    DeleteCohortSqlParams,
    DeleteCohortSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/cohorts/delete_cohort_complete.sql"
ACCESS_SQL_PATH = "app/sql/v4/queries/cohorts/check_cohort_delete_access_complete.sql"


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteCohortApiResponse,
    dependencies=[
        audit_activity(
            "cohort.deleted", "{{ actor.name }} deleted cohort '{{ cohort.name }}'"
        )
    ],
)
async def delete_cohort(
    request: DeleteCohortApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteCohortApiResponse:
    """Delete a cohort."""
    tags = ["cohorts"]  # From router tags

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

        # Phase 1: SQL access check
        access_params = CheckCohortDeleteAccessSqlParams(
            profile_id=profile_id,
            cohort_id=request.cohort_id,
        )
        access_result = cast(
            CheckCohortDeleteAccessSqlRow,
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

        if not access_result.cohort_exists:
            raise HTTPException(
                status_code=404,
                detail=f"Cohort not found: {request.cohort_id}",
            )

        if not has_access(
            user_role,
            user_department_ids,
            access_result.cohort_department_ids or [],
        ):
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this cohort.",
            )

        # Phase 2: Python permission check
        usage_count = access_result.usage_count or 0
        if not compute_can_delete(
            user_role, access_result.cohort_department_ids, usage_count
        ):
            if usage_count > 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot delete cohort: has {usage_count} profile link(s) (preserved for historical data)",
                )
            else:
                raise HTTPException(
                    status_code=403,
                    detail="You don't have permission to delete this cohort.",
                )

        # Execute delete (inside transaction)
        async with conn.transaction():
            # Convert API request to SQL params (add profile_id from header)
            params = DeleteCohortSqlParams(
                **request.model_dump(), profile_id=profile_id
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                DeleteCohortSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if result.usage_count and result.usage_count > 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot delete cohort: has {result.usage_count} profile link(s) (preserved for historical data)",
                )

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    cohort={
                        "name": result.name or "Unknown",
                        "id": str(request.cohort_id),
                    },
                )

        # Convert SQL result to API response (no manual conversion needed)
        api_response = DeleteCohortApiResponse.model_validate(result.model_dump())

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
            operation="delete_cohort",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
