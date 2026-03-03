"""Models list endpoint - v4 API following DHH principles.

Two-pass architecture:
1. SQL returns raw data with department_ids and agents_usage_count
2. Python computes permissions (can_edit, can_delete, can_duplicate)

Filter option names resolved in SQL via ListFilterSection pattern.
Provider names for per-model display hydrated from cached get_providers_internal().
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.model.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.v5.api.main.model.types import (
    ListModelApiModel,
    ListModelApiResponse,
)
from app.v5.api.auth.profile import get_auth_profile_internal
from app.v5.api.resources.providers.get import get_providers_internal
from app.v5.api.types import ListFilterSection
from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.v5.sql.types import (
    ListModelsApiRequest,
    ListModelsSqlParams,
    ListModelsSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/v5/sql/queries/models/list_models_complete.sql"

router = APIRouter()


@router.post("/list", response_model=ListModelApiResponse)
async def get_model_list(
    request: ListModelsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListModelApiResponse:
    """Get models list with permissions and provider details."""
    tags = ["models"]

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
            return ListModelApiResponse.model_validate(cached["data"])

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

        # Convert API request to SQL params (add profile_id from header + request body fields)
        params = ListModelsSqlParams(
            profile_id=profile_id,
            search=request.search,
            filter_provider_ids=request.filter_provider_ids,
            filter_department_ids=request.filter_department_ids,
            filter_agent_ids=getattr(request, "filter_agent_ids", None),
            provider_search=request.provider_search,
            department_search=request.department_search,
            agent_search=getattr(request, "agent_search", None),
            page_size=request.page_size,
            page_offset=request.page_offset,
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper
        result = cast(
            ListModelsSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Compute permissions for each model in Python
        models_with_permissions: list[ListModelApiModel] = []
        model_provider_ids: set[UUID] = set()
        for model in result.models or []:
            can_edit_val = compute_can_edit(
                user_role=user_role,
                model_department_ids=model.department_ids,
                active_agent_count=model.active_agent_count or 0,
                user_department_ids=user_department_ids,
            )
            can_delete_val = compute_can_delete(
                user_role=user_role,
                model_department_ids=model.department_ids,
                active_agent_count=model.active_agent_count or 0,
            )
            can_duplicate_val = compute_can_duplicate(user_role)

            if model.provider_id:
                uid = (
                    UUID(str(model.provider_id))
                    if not isinstance(model.provider_id, UUID)
                    else model.provider_id
                )
                model_provider_ids.add(uid)

            models_with_permissions.append(
                ListModelApiModel(
                    model_id=model.model_id,
                    name=model.name,
                    description=model.description,
                    provider_id=model.provider_id,
                    department_ids=model.department_ids,
                    is_inactive=model.is_inactive,
                    active=not model.is_inactive
                    if model.is_inactive is not None
                    else True,
                    image_model=model.image_model,
                    can_edit=can_edit_val,
                    can_duplicate=can_duplicate_val,
                    can_delete=can_delete_val,
                    updated_at=model.updated_at,
                )
            )

        # Hydrate provider_name per model from cached providers
        if pool and model_provider_ids:
            async with pool.acquire() as c:
                providers_data = await get_providers_internal(
                    c, list(model_provider_ids), bypass_cache
                )
            provider_map: dict[UUID, Any] = {}
            for p in providers_data:
                p_id = getattr(p, "id", None)
                if p_id:
                    uid = UUID(str(p_id)) if not isinstance(p_id, UUID) else p_id
                    provider_map[uid] = p

            for model_item in models_with_permissions:
                if model_item.provider_id:
                    uid = (
                        UUID(str(model_item.provider_id))
                        if not isinstance(model_item.provider_id, UUID)
                        else model_item.provider_id
                    )
                    provider = provider_map.get(uid)
                    if provider:
                        model_item.provider_name = getattr(provider, "name", None)
                        model_item.base_url = getattr(provider, "endpoint", None) or ""

        # Build API response with ListFilterSection pattern
        api_response = ListModelApiResponse(
            actor_name=actor_name,
            models=models_with_permissions,
            provider_filter=ListFilterSection.from_sql_options(
                result.provider_options,
                request.filter_provider_ids,
                request.provider_search,
            ),
            department_filter=ListFilterSection.from_sql_options(
                result.department_options,
                request.filter_department_ids,
                request.department_search,
            ),
            agent_filter=ListFilterSection.from_sql_options(
                result.agent_options,
                getattr(request, "filter_agent_ids", None),
                getattr(request, "agent_search", None),
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
            operation="get_model_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
