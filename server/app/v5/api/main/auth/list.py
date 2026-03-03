"""Auth list endpoint - v4 API following DHH principles.

Two-pass architecture:
1. SQL returns raw data with department_ids
2. Python computes permissions (can_edit, can_delete, can_duplicate)

Filter option names hydrated from cached *_internal() functions.
Search filtering applied in Python for option names.
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.auth.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.v5.api.main.auth.types import (
    ListAuthApiAuth,
    ListAuthApiResponse,
)
from app.auth.profile import get_auth_profile_internal
from app.v5.api.types import ListFilterSection
from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db, get_pool
from app.sql.types import (
    GetAuthListApiRequest,
    GetAuthListSqlParams,
    GetAuthListSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/queries/auth/get_auth_list_complete.sql"

router = APIRouter()


@router.post("/list", response_model=ListAuthApiResponse)
async def get_auth_list(
    request: GetAuthListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListAuthApiResponse:
    """Get auth list with item counts and permissions."""
    tags = ["auth"]

    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return ListAuthApiResponse.model_validate(cached["data"])

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

        # Convert API request to SQL params
        params = GetAuthListSqlParams(
            profile_id=profile_id,
            search=request.search,
            filter_department_ids=request.filter_department_ids,
            department_search=request.department_search,
            page_size=request.page_size,
            page_offset=request.page_offset,
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper
        result = cast(
            GetAuthListSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Compute permissions for each auth in Python
        auths_list: list[ListAuthApiAuth] = []
        for auth in result.auths or []:
            active_settings_count = auth.active_settings_count or 0
            can_edit_val = compute_can_edit(
                user_role=user_role,
                active_settings_count=active_settings_count,
            )
            can_delete_val = compute_can_delete(
                user_role=user_role,
                active_settings_count=active_settings_count,
            )
            can_duplicate_val = compute_can_duplicate(user_role=user_role)

            auths_list.append(
                ListAuthApiAuth(
                    auth_id=auth.auth_id,
                    name=auth.name,
                    description=auth.description,
                    item_count=auth.num_items,
                    department_ids=auth.department_ids,
                    is_inactive=auth.is_inactive,
                    can_edit=can_edit_val,
                    can_duplicate=can_duplicate_val,
                    can_delete=can_delete_val,
                )
            )

        # Build API response with ListFilterSection pattern (names resolved in SQL)
        api_response = ListAuthApiResponse(
            actor_name=actor_name,
            auths=auths_list,
            department_filter=ListFilterSection.from_sql_options(
                getattr(result, "department_options", None),
                getattr(request, "filter_department_ids", None),
                getattr(request, "department_search", None),
            ),
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
            operation="get_auth_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
