"""Providers list endpoint - v4 API following DHH principles.

Two-pass architecture:
1. SQL returns raw data with department_ids and model_usage_count
2. Python computes permissions (can_edit, can_delete, can_duplicate)

Filter option names resolved in SQL via ListFilterSection pattern.
"""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.provider.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.v5.api.main.provider.types import (
    ListProviderApiProvider,
    ListProviderApiResponse,
)
from app.v5.api.auth.profile import get_auth_profile_internal
from app.v5.api.types import ListFilterSection
from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import get_db, get_pool
from app.v5.sql.types import (
    GetProvidersListApiRequest,
    GetProvidersListSqlParams,
    GetProvidersListSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/v5/sql/queries/providers/get_providers_list_complete.sql"

router = APIRouter()


@router.post("/list", response_model=ListProviderApiResponse)
async def get_provider_list(
    request: GetProvidersListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListProviderApiResponse:
    """Get providers list with Python-computed permissions."""
    tags = ["providers"]

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
            return ListProviderApiResponse.model_validate(cached["data"])

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

        # Convert API request to SQL params (add profile_id from header)
        params = GetProvidersListSqlParams(
            profile_id=profile_id,
            search=getattr(request, "search", None),
            filter_department_ids=getattr(request, "filter_department_ids", None),
            filter_model_ids=getattr(request, "filter_model_ids", None),
            filter_status=getattr(request, "filter_status", None),
            department_search=getattr(request, "department_search", None),
            model_search=getattr(request, "model_search", None),
            page_size=getattr(request, "page_size", 1000),
            page_offset=getattr(request, "page_offset", 0),
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper
        result = cast(
            GetProvidersListSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Compute permissions for each provider in Python
        providers_list: list[ListProviderApiProvider] = []

        if result.providers:
            for p in result.providers:
                provider_dept_ids = p.department_ids or []
                active_model_count = p.active_model_count or 0

                providers_list.append(
                    ListProviderApiProvider(
                        provider_id=p.provider_id,
                        name=p.name,
                        description=p.description,
                        value=p.value,
                        active=p.active,
                        updated_at=p.updated_at,
                        department_ids=p.department_ids,
                        model_usage_count=active_model_count,
                        model_ids=p.model_ids,
                        can_edit=compute_can_edit(
                            user_role=user_role,
                            provider_department_ids=provider_dept_ids,
                            active_model_count=active_model_count,
                            user_department_ids=user_department_ids,
                        ),
                        can_delete=compute_can_delete(
                            user_role=user_role,
                            provider_department_ids=provider_dept_ids,
                            active_model_count=active_model_count,
                        ),
                        can_duplicate=compute_can_duplicate(user_role=user_role),
                    )
                )

        # Build API response with ListFilterSection pattern
        api_response = ListProviderApiResponse(
            actor_name=actor_name,
            providers=providers_list,
            department_filter=ListFilterSection.from_sql_options(
                result.department_options,
                getattr(request, "filter_department_ids", None),
                getattr(request, "department_search", None),
            ),
            model_filter=ListFilterSection.from_sql_options(
                result.model_options,
                getattr(request, "filter_model_ids", None),
                getattr(request, "model_search", None),
            ),
            status_filter=ListFilterSection.from_sql_options(
                result.status_options,
                getattr(request, "filter_status", None),
                None,
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
            operation="get_provider_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
