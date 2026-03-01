"""Department duplicate endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.department.permissions import compute_can_duplicate
from app.api.v4.artifacts.department.types import (
    DuplicateDepartmentApiRequest,
    DuplicateDepartmentApiResponse,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    CheckDepartmentDuplicateAccessSqlParams,
    CheckDepartmentDuplicateAccessSqlRow,
    DuplicateDepartmentSqlParams,
    DuplicateDepartmentSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/v4/queries/departments/check_department_duplicate_access_complete.sql"
)
DUPLICATE_SQL_PATH = "app/sql/v4/queries/departments/duplicate_department_complete.sql"

router = APIRouter()


@router.post("/duplicate", response_model=DuplicateDepartmentApiResponse)
async def duplicate_department(
    request: DuplicateDepartmentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateDepartmentApiResponse:
    """Duplicate a department."""
    tags = ["departments"]

    sql_query = load_sql_query(DUPLICATE_SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
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
        else:
            actor_name = None
            user_role = None

        # Permission check: get user role using typed SQL
        access_params = CheckDepartmentDuplicateAccessSqlParams(
            profile_id=profile_id,
        )
        access_result = cast(
            CheckDepartmentDuplicateAccessSqlRow,
            await execute_sql_typed(
                conn,
                ACCESS_CHECK_SQL_PATH,
                params=access_params,
            ),
        )

        if not access_result:
            raise HTTPException(
                status_code=401,
                detail="Unable to verify user permissions.",
            )

        can_duplicate = compute_can_duplicate(user_role=user_role)

        if not can_duplicate:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to duplicate this department.",
            )

        async with conn.transaction():
            params = DuplicateDepartmentSqlParams(
                **request.model_dump(), profile_id=profile_id
            )
            sql_params = params.to_tuple()

            result = cast(
                DuplicateDepartmentSqlRow,
                await execute_sql_typed(
                    conn,
                    DUPLICATE_SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.new_department_id:
                raise ValueError(f"Department not found: {request.department_id}")

            original_title = result.original_title or "Unknown"

        api_response = DuplicateDepartmentApiResponse(
            success=True,
            department_id=result.new_department_id,
            message=f"Department '{original_title}' duplicated successfully",
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
            operation="duplicate_department",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
