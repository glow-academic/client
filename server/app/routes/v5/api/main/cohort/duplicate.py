"""Cohort duplicate endpoint - v4 API following DHH principles."""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_pool
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.v5.api.main.cohort.permissions import compute_can_duplicate
from app.routes.v5.tools.resources.names.create import create_name
from app.sql.types import (
    CheckCohortDuplicateAccessSqlParams,
    CheckCohortDuplicateAccessSqlRow,
    DuplicateCohortApiRequest,
    DuplicateCohortApiResponse,
    DuplicateCohortSqlParams,
    DuplicateCohortSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/queries/cohorts/duplicate_cohort_complete.sql"
ACCESS_SQL_PATH = (
    "app/sql/queries/cohorts/check_cohort_duplicate_access_complete.sql"
)

router = APIRouter()


@router.post("/duplicate", response_model=DuplicateCohortApiResponse)
async def duplicate_cohort(
    request: DuplicateCohortApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateCohortApiResponse:
    """Duplicate a cohort with relationships."""
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
                session_id = profile_ctx.session_id
        else:
            actor_name = None
            user_role = None
            session_id = None

        # Permission check: access query
        access_params = CheckCohortDuplicateAccessSqlParams(
            profile_id=profile_id,
            cohort_id=request.cohort_id,
        )
        access_result = cast(
            CheckCohortDuplicateAccessSqlRow,
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

        if not compute_can_duplicate(user_role):
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to duplicate cohorts.",
            )

        # Phase 1: Python creates name resource
        original_name = access_result.original_name or "Unknown"
        new_name = f"{original_name} Copy"
        name_resource_id = (await create_name(conn, new_name)).name_id

        # Phase 2: SQL creates artifact + links junctions (inside transaction)
        async with conn.transaction():
            params = DuplicateCohortSqlParams(
                cohort_id=request.cohort_id,
                profile_id=uuid.UUID(profile_id),
                name_resource_id=name_resource_id,
                session_id=session_id,
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                DuplicateCohortSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.id:
                raise HTTPException(status_code=404, detail="Cohort not found")

        # Convert SQL result to API response (no manual conversion needed)
        api_response = DuplicateCohortApiResponse.model_validate(result.model_dump())

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
            operation="duplicate_cohort",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
