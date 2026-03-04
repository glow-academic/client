"""Fields list endpoint - v4 API following DHH principles.

Two-pass architecture:
1. SQL returns raw data with department_ids and total_parameter_links
2. Python computes permissions (can_edit, can_delete, can_duplicate)

Filter option names hydrated from cached *_internal() functions.
Search filtering applied in Python.
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_pool
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.v5.api.main.field.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.routes.v5.api.main.field.types import (
    ListFieldApiField,
    ListFieldApiResponse,
)
from app.routes.v5.api.types import ListFilterSection
from app.sql.types import (
    GetFieldsListApiRequest,
    GetFieldsListSqlParams,
    GetFieldsListSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/queries/fields/get_fields_list_complete.sql"

router = APIRouter()


@router.post("/list", response_model=ListFieldApiResponse)
async def get_field_list(
    request: GetFieldsListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListFieldApiResponse:
    """Get fields list with permissions and relationships."""
    tags = ["fields"]

    # Check for cache bypass header (for testing)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return ListFieldApiResponse.model_validate(cached["data"])

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
                user_department_ids = [
                    d.department_id for d in profile_ctx.departments if d.department_id
                ]
        else:
            actor_name = None
            user_role = None
            user_department_ids = []

        params = GetFieldsListSqlParams(
            profile_id=profile_id,
            search=request.search,
            parameter_ids=request.parameter_ids,
            persona_ids=request.persona_ids,
            filter_department_ids=request.filter_department_ids,
            parameter_search=request.parameter_search,
            persona_search=request.persona_search,
            department_search=request.department_search,
            page_size=request.page_size,
            page_offset=request.page_offset,
        )
        sql_params = params.to_tuple()

        result = cast(
            GetFieldsListSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # user_role already fetched from context above

        # Compute permissions for each field in Python
        fields_with_permissions: list[ListFieldApiField] = []
        for field in result.fields or []:
            can_edit_val = compute_can_edit(
                user_role=user_role,
                field_department_ids=field.department_ids,
                active_parameter_count=field.active_parameter_count or 0,
                user_department_ids=user_department_ids,
            )
            can_delete_val = compute_can_delete(
                user_role=user_role,
                field_department_ids=field.department_ids,
                active_parameter_count=field.active_parameter_count or 0,
            )
            can_duplicate_val = compute_can_duplicate(user_role)

            fields_with_permissions.append(
                ListFieldApiField(
                    field_id=field.field_id,
                    name=field.name,
                    description=field.description,
                    department_ids=field.department_ids,
                    conditional_parameter_ids=field.conditional_parameter_ids,
                    persona_ids=field.persona_ids,
                    is_inactive=field.is_inactive,
                    can_edit=can_edit_val,
                    can_duplicate=can_duplicate_val,
                    can_delete=can_delete_val,
                    updated_at=field.updated_at,
                )
            )

        # Build API response with filter sections (names resolved in SQL)
        api_response = ListFieldApiResponse(
            actor_name=actor_name,
            fields=fields_with_permissions,
            parameter_filter=ListFilterSection.from_sql_options(
                result.parameter_options,
                request.parameter_ids,
                request.parameter_search,
            ),
            persona_filter=ListFilterSection.from_sql_options(
                result.persona_options,
                request.persona_ids,
                request.persona_search,
            ),
            department_filter=ListFilterSection.from_sql_options(
                result.department_options,
                request.filter_department_ids,
                request.department_search,
            ),
            total_count=result.total_count,
        )

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=60,
            tags=tags,
            redis=get_redis_client(),
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
            operation="get_field_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
