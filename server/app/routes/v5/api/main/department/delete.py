"""Department delete endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.main.department.permissions import compute_can_delete
from app.routes.v5.api.main.department.types import (
    DeleteDepartmentApiRequest,
    DeleteDepartmentApiResponse,
)
from app.routes.auth.profile import get_auth_profile_internal
from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db, get_pool
from app.sql.types import (
    CheckDepartmentDeleteAccessSqlParams,
    CheckDepartmentDeleteAccessSqlRow,
    DeleteDepartmentSqlParams,
    DeleteDepartmentSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/queries/departments/check_department_delete_access_complete.sql"
)
DELETE_SQL_PATH = "app/sql/queries/departments/delete_department_complete.sql"

router = APIRouter()


@router.post("/delete", response_model=DeleteDepartmentApiResponse)
async def delete_department(
    request: DeleteDepartmentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteDepartmentApiResponse:
    """Delete a department."""
    tags = ["departments"]

    sql_query = load_sql_query(DELETE_SQL_PATH)
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

        # Permission check: get user role and department info using typed SQL
        access_params = CheckDepartmentDeleteAccessSqlParams(
            profile_id=profile_id,
            department_id=request.department_id,
        )
        access_result = cast(
            CheckDepartmentDeleteAccessSqlRow,
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

        can_delete = compute_can_delete(
            user_role=user_role,
            total_usage=access_result.total_usage or 0,
        )

        if not can_delete:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to delete this department.",
            )

        async with conn.transaction():
            params = DeleteDepartmentSqlParams(
                **request.model_dump(), profile_id=profile_id
            )
            sql_params = params.to_tuple()

            result = cast(
                DeleteDepartmentSqlRow,
                await execute_sql_typed(
                    conn,
                    DELETE_SQL_PATH,
                    params=params,
                ),
            )

            if not result:
                raise ValueError("Failed to check department usage")

            if not result.department_exists:
                raise HTTPException(
                    status_code=404,
                    detail=f"Department {request.department_id} not found",
                )

            if not result.deleted:
                total_usage = result.total_usage
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot delete department: in use by {total_usage} entities",
                )

            department_title = result.title or "Unknown"

        api_response = DeleteDepartmentApiResponse(
            success=True,
            message=f"Department '{department_title}' deleted successfully",
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
            operation="delete_department",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
