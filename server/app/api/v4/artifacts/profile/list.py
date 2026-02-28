"""Profiles list endpoint - resource-first pattern with Python permission computation.

Two-pass architecture:
1. SQL returns raw data with target_is_self and active_cohort_count
2. Python computes permissions (can_edit, can_delete, can_duplicate) via role hierarchy

Filter option names hydrated from cached *_internal() functions.
Search filtering for cohort/department options applied in Python.
"""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.profile.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.api.v4.artifacts.profile.types import (
    ListProfilesApiProfile,
    ListProfilesApiResponse,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.types import ListFilterSection
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetProfilesListApiRequest,
    GetProfilesListSqlParams,
    GetProfilesListSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/profiles/get_profiles_list_complete.sql"


router = APIRouter()


@router.post(
    "/list",
    response_model=ListProfilesApiResponse,
    dependencies=[
        audit_activity("profile.list", "{{ actor.name }} viewed profiles list")
    ],
)
async def get_profile_list(
    request: GetProfilesListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListProfilesApiResponse:
    """Get profiles list with permissions and relationships."""
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
            return ListProfilesApiResponse.model_validate(cached["data"])

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
                user_department_ids = [
                    d.department_id for d in profile_ctx.departments if d.department_id
                ]
        else:
            actor_name = None
            user_role = None
            user_department_ids = []

        # Convert API request to SQL params
        params = GetProfilesListSqlParams(
            profile_id=profile_id,
            search=request.search,
            cohort_ids=request.cohort_ids,
            filter_department_ids=request.filter_department_ids,
            role_filter=request.role_filter,
            cohort_search=request.cohort_search,
            department_search=request.department_search,
            role_search=request.role_search,
            page_size=request.page_size,
            page_offset=request.page_offset,
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper
        result = cast(
            GetProfilesListSqlRow,
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

        # Compute permissions for each profile in Python
        profiles_with_permissions: list[ListProfilesApiProfile] = []
        for s in result.profiles or []:
            target_is_self = getattr(s, "target_is_self", False) or False
            target_role = getattr(s, "role", None)
            can_edit_val = compute_can_edit(
                user_role=user_role,
                target_is_self=target_is_self,
                target_department_ids=None,
                target_role=target_role,
                user_department_ids=user_department_ids,
            )
            can_delete_val = compute_can_delete(
                user_role=user_role,
                target_is_self=target_is_self,
                target_role=target_role,
            )
            can_duplicate_val = compute_can_duplicate(user_role)

            profiles_with_permissions.append(
                ListProfilesApiProfile(
                    profile_id=s.profile_id,
                    emails=s.emails,
                    primary_email=s.primary_email,
                    name=s.name,
                    role=target_role,
                    initials=s.initials,
                    department_ids=s.department_ids,
                    primary_department_id=s.primary_department_id,
                    requests_per_day=s.requests_per_day,
                    can_edit=can_edit_val,
                    can_duplicate=can_duplicate_val,
                    can_delete=can_delete_val,
                )
            )

        # Build API response with filter sections (names resolved in SQL)
        api_response = ListProfilesApiResponse(
            actor_name=actor_name,
            profiles=profiles_with_permissions,
            department_filter=ListFilterSection.from_sql_options(
                result.department_options,
                request.filter_department_ids,
                request.department_search,
            ),
            role_filter=ListFilterSection.from_sql_options(
                result.role_options,
                [request.role_filter] if request.role_filter else None,
                request.role_search,
            ),
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
            operation="get_profile_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
