"""Department list endpoint - v4 API following DHH principles.

Uses existing list SQL which computes permissions in SQL.
Maps results to handcrafted response types.
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.department.types import (
    ListDepartmentApiCohort,
    ListDepartmentApiDepartment,
    ListDepartmentApiProfile,
    ListDepartmentApiResponse,
)
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
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
SQL_PATH = "app/sql/v4/queries/departments/get_departments_list_complete.sql"

router = APIRouter()


@router.post(
    "/list",
    response_model=ListDepartmentApiResponse,
    dependencies=[
        audit_activity(
            "departments.list", "{{ actor.name }} visited the Departments page"
        )
    ],
)
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

        # Convert API request to SQL params
        params = GetDepartmentsListSqlParams(
            **request.model_dump(), profile_id=profile_id
        )
        sql_params = params.to_tuple()

        # Execute query
        result = cast(
            GetDepartmentsListSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        # Map SQL results to handcrafted types
        departments = [
            ListDepartmentApiDepartment(
                department_id=d.department_id,
                name=d.title,
                description=d.description,
                staff_count=d.staff_count,
                is_inactive=not d.active if d.active is not None else None,
                can_edit=d.can_edit,
                can_duplicate=d.can_duplicate,
                can_delete=d.can_delete,
                updated_at=d.updated_at,
            )
            for d in (result.departments or [])
        ]

        cohorts = [
            ListDepartmentApiCohort(
                cohort_id=c.cohort_id,
                name=c.name,
                description=c.description,
            )
            for c in (result.cohorts or [])
        ]

        profiles = [
            ListDepartmentApiProfile(
                profile_id=p.profile_id,
                name=p.name,
            )
            for p in (result.profiles or [])
        ]

        api_response = ListDepartmentApiResponse(
            actor_name=result.actor_name,
            departments=departments,
            cohorts=cohorts,
            profiles=profiles,
            total_count=len(departments),
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
