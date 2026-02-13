"""Staff list endpoint - resource-first pattern with Python permission computation.

Two-pass architecture:
1. SQL returns raw data with target_is_self and total_cohort_links
2. Python computes permissions (can_edit, can_delete, can_duplicate) via role hierarchy

Filter option names hydrated from cached *_internal() functions.
Search filtering for cohort/department options applied in Python.
"""

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.profile.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.api.v4.artifacts.profile.types import (
    ListStaffApiCohort,
    ListStaffApiDepartment,
    ListStaffApiResponse,
    ListStaffApiStaff,
    ListStaffApiTrendData,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.resources.cohorts.get import get_cohorts_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetStaffListApiRequest,
    GetStaffListSqlParams,
    GetStaffListSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/staff/get_staff_list_complete.sql"


router = APIRouter()


@router.post(
    "/list",
    response_model=ListStaffApiResponse,
    dependencies=[audit_activity("staff.list", "{{ actor.name }} viewed staff list")],
)
async def get_profile_list(
    request: GetStaffListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListStaffApiResponse:
    """Get profile/staff list with permissions and relationships."""
    tags = ["profile"]

    # Check for cache bypass header (for testing)
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
            return ListStaffApiResponse.model_validate(cached["data"])

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

        # Fetch user context for audit logging and permissions
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

        # Convert API request to SQL params
        params = GetStaffListSqlParams(
            profile_id=profile_id,
            search=request.search,
            cohort_ids=request.cohort_ids,
            filter_department_ids=request.filter_department_ids,
            role_filter=request.role_filter,
            cohort_search=request.cohort_search,
            department_search=request.department_search,
            page_size=request.page_size,
            page_offset=request.page_offset,
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper
        result = cast(
            GetStaffListSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        # user_role already fetched from context above

        # Compute permissions for each staff member in Python
        staff_with_permissions: list[ListStaffApiStaff] = []
        for s in result.staff or []:
            target_is_self = getattr(s, "target_is_self", False) or False
            target_role = getattr(s, "role", None)
            total_cohort_links = int(getattr(s, "total_cohort_links", 0) or 0)

            can_edit_val = compute_can_edit(
                user_role=user_role,
                target_is_self=target_is_self,
                target_department_ids=None,
                target_role=target_role,
            )
            can_delete_val = compute_can_delete(
                user_role=user_role,
                target_is_self=target_is_self,
                target_role=target_role,
                total_cohort_links=total_cohort_links,
            )
            can_duplicate_val = compute_can_duplicate(user_role)

            staff_with_permissions.append(
                ListStaffApiStaff(
                    profile_id=s.profile_id,
                    emails=s.emails,
                    primary_email=s.primary_email,
                    name=s.name,
                    role=target_role,
                    initials=s.initials,
                    active=s.active,
                    last_active=s.last_active,
                    cohort_ids=s.cohort_ids,
                    department_ids=s.department_ids,
                    primary_department_id=s.primary_department_id,
                    requests_per_day=s.requests_per_day,
                    total_requests=s.total_requests,
                    requests_in_last_day=s.requests_in_last_day,
                    can_edit=can_edit_val,
                    can_duplicate=can_duplicate_val,
                    can_delete=can_delete_val,
                )
            )

        # --- Python hydration: filter option names from cached *_internal() ---
        cohort_option_ids = getattr(result, "cohort_option_ids", None) or []
        department_option_ids = getattr(result, "department_option_ids", None) or []

        # Build ID -> count maps
        cohort_count_map: dict[UUID, int] = {}
        cohort_ids_to_fetch: list[UUID] = []
        for opt in cohort_option_ids:
            opt_id = getattr(opt, "id", None)
            opt_count = getattr(opt, "count", 0)
            if opt_id:
                uid = UUID(str(opt_id)) if not isinstance(opt_id, UUID) else opt_id
                cohort_count_map[uid] = int(opt_count or 0)
                cohort_ids_to_fetch.append(uid)

        department_count_map: dict[UUID, int] = {}
        department_ids_to_fetch: list[UUID] = []
        for opt in department_option_ids:
            opt_id = getattr(opt, "id", None)
            opt_count = getattr(opt, "count", 0)
            if opt_id:
                uid = UUID(str(opt_id)) if not isinstance(opt_id, UUID) else opt_id
                department_count_map[uid] = int(opt_count or 0)
                department_ids_to_fetch.append(uid)

        # Parallel fetch names from cached *_internal() functions
        cohorts_data = []
        departments_data = []

        pool = get_pool()
        has_ids = any([cohort_ids_to_fetch, department_ids_to_fetch])

        if pool and has_ids:

            async def fetch_cohorts() -> list:
                if not cohort_ids_to_fetch:
                    return []
                async with pool.acquire() as c:
                    return await get_cohorts_internal(
                        c, cohort_ids_to_fetch, bypass_cache
                    )

            async def fetch_departments() -> list:
                if not department_ids_to_fetch:
                    return []
                async with pool.acquire() as c:
                    return await get_departments_internal(
                        c, department_ids_to_fetch, bypass_cache
                    )

            cohorts_data, departments_data = await asyncio.gather(
                fetch_cohorts(), fetch_departments()
            )

        # Merge names with counts, apply search filtering in Python
        cohort_search = request.cohort_search
        cohorts: list[ListStaffApiCohort] = [
            ListStaffApiCohort(
                cohort_id=s.cohort_id,
                name=s.title,  # QGetCohortsV4Item uses 'title' not 'name'
                description=s.description or "",
                count=cohort_count_map.get(s.cohort_id, 0) if s.cohort_id else 0,
            )
            for s in cohorts_data
            if s.cohort_id
            and (
                cohort_search is None
                or cohort_search.lower() in (s.title or "").lower()
            )
        ]

        department_search = request.department_search
        departments: list[ListStaffApiDepartment] = [
            ListStaffApiDepartment(
                department_id=d.department_id,
                name=d.name,
                description=d.description or "",
                count=department_count_map.get(d.department_id, 0)
                if d.department_id
                else 0,
            )
            for d in departments_data
            if d.department_id
            and (
                department_search is None
                or department_search.lower() in (d.name or "").lower()
            )
        ]

        # Build trend data
        trend_data_active = [
            ListStaffApiTrendData(date=t.date, value=t.value, count=t.count)
            for t in (result.trend_data_active or [])
        ]
        trend_data_admin = [
            ListStaffApiTrendData(date=t.date, value=t.value, count=t.count)
            for t in (result.trend_data_admin or [])
        ]
        trend_data_instructional = [
            ListStaffApiTrendData(date=t.date, value=t.value, count=t.count)
            for t in (result.trend_data_instructional or [])
        ]
        trend_data_member = [
            ListStaffApiTrendData(date=t.date, value=t.value, count=t.count)
            for t in (result.trend_data_member or [])
        ]
        trend_data_total_requests = [
            ListStaffApiTrendData(date=t.date, value=t.value, count=t.count)
            for t in (result.trend_data_total_requests or [])
        ]

        # Build API response with computed permissions and hydrated names
        api_response = ListStaffApiResponse(
            actor_name=actor_name,
            staff=staff_with_permissions,
            cohorts=cohorts,
            departments=departments,
            trend_data_active=trend_data_active,
            trend_data_admin=trend_data_admin,
            trend_data_instructional=trend_data_instructional,
            trend_data_member=trend_data_member,
            trend_data_total_requests=trend_data_total_requests,
            role_options=result.role_options,
            last_active_options=result.last_active_options,
            total_count=result.total_count,
        )

        # Cache response (use mode='json' to serialize UUIDs and other types)
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
            operation="get_staff_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
