"""Cohort delete endpoint - v4 API."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.auth.context import get_profile_context_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
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

        # Fetch user context for audit logging
        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                resolved_context = await get_profile_context_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    department_id_cookie=None,
                    bypass_cache=False,
                )
                actor_name = resolved_context.actor_name
        else:
            actor_name = None

        # Convert API request to SQL params (add profile_id from header)
        params = DeleteCohortSqlParams(**request.model_dump(), profile_id=profile_id)
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
                    "name": result.title or "Unknown",
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
