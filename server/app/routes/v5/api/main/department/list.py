"""Department list endpoint - v4 API following DHH principles.

Two-pass architecture:
1. SQL returns raw data with total_usage
2. Python computes permissions (can_edit, can_delete, can_duplicate)

No cross-entity hydration needed — department names come directly from SQL.
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.main.department.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.routes.v5.api.main.department.types import (
    ListDepartmentApiDepartment,
    ListDepartmentApiResponse,
)
from app.routes.auth.profile import get_auth_profile_internal
from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import get_db, get_pool
from app.sql.types import (
    GetDepartmentsListApiRequest,
    GetDepartmentsListSqlParams,
    GetDepartmentsListSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/sql/queries/departments/get_departments_list_complete.sql"

router = APIRouter()


@router.post("/list", response_model=ListDepartmentApiResponse)
async def get_department_list(
    request: GetDepartmentsListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListDepartmentApiResponse:
    """Get list of departments with computed fields."""
    tags = ["departments"]

    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return ListDepartmentApiResponse.model_validate(cached["data"])

    sql_query = load_sql_query(SQL_PATH)
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
                    bypass_cache=bypass_cache,
                )
                actor_name = profile_ctx.access.actor_name
                user_role = profile_ctx.access.role
        else:
            actor_name = None
            user_role = None

        # Convert API request to SQL params (add profile_id + user_role from context)
        params = GetDepartmentsListSqlParams(
            profile_id=profile_id,
            user_role=user_role or "member",
            search=request.search,
            page_size=request.page_size,
            page_offset=request.page_offset,
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper
        result = cast(
            GetDepartmentsListSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Compute permissions for each department in Python
        departments = [
            ListDepartmentApiDepartment(
                department_id=d.department_id,
                name=d.name,
                description=d.description,
                staff_count=d.staff_count,
                is_inactive=d.is_inactive,
                can_edit=compute_can_edit(
                    user_role=user_role, usage_count=d.total_usage or 0
                ),
                can_duplicate=compute_can_duplicate(user_role=user_role),
                can_delete=compute_can_delete(
                    user_role=user_role, total_usage=d.total_usage or 0
                ),
                updated_at=d.updated_at,
            )
            for d in (result.departments or [])
        ]

        api_response = ListDepartmentApiResponse(
            actor_name=actor_name,
            departments=departments,
            total_count=result.total_count,
        )

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_department_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
