"""Models list endpoint - v4 API following DHH principles.

Two-pass architecture:
1. SQL returns raw data with department_ids and agents_usage_count
2. Python computes permissions (can_edit, can_delete, can_duplicate)

Filter option names hydrated from cached *_internal() functions.
Search filtering applied in Python for option names.
"""

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.model.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.api.v4.artifacts.model.types import (
    ListModelApiDepartment,
    ListModelApiModel,
    ListModelApiProvider,
    ListModelApiResponse,
)
from app.api.v4.auth.context import get_profile_context_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.providers.get import get_providers_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    ListModelsApiRequest,
    ListModelsSqlParams,
    ListModelsSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/models/list_models_complete.sql"

router = APIRouter()


@router.post(
    "/list",
    response_model=ListModelApiResponse,
    dependencies=[
        audit_activity("models.list", "{{ actor.name }} visited the Models page")
    ],
)
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

        # Fetch user context for audit logging and permissions
        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                resolved_context = await get_profile_context_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    bypass_cache=bypass_cache,
                )
                actor_name = resolved_context.actor_name
                user_role = resolved_context.user_role
        else:
            actor_name = None
            user_role = None

        # Convert API request to SQL params (add profile_id from header + request body fields)
        params = ListModelsSqlParams(
            profile_id=profile_id,
            search=request.search,
            filter_provider_ids=request.filter_provider_ids,
            filter_department_ids=request.filter_department_ids,
            provider_search=request.provider_search,
            department_search=request.department_search,
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

        # Set audit context
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        # Compute permissions for each model in Python
        models_with_permissions: list[ListModelApiModel] = []
        model_provider_ids: set[UUID] = set()
        for model in result.models or []:
            can_edit_val = compute_can_edit(
                user_role=user_role,
                model_department_ids=model.department_ids,
                active_persona_count=0,
            )
            can_delete_val = compute_can_delete(
                user_role=user_role,
                model_department_ids=model.department_ids,
                total_persona_links=0,
                agents_usage_count=model.agents_usage_count or 0,
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

        # --- Python hydration: filter option names from cached *_internal() ---
        # Extract option IDs and counts from SQL result
        provider_option_ids = getattr(result, "provider_option_ids", None) or []
        department_option_ids = getattr(result, "department_option_ids", None) or []

        # Build ID -> count maps
        provider_count_map: dict[UUID, int] = {}
        provider_ids_to_fetch: list[UUID] = []
        for opt in provider_option_ids:
            opt_id = getattr(opt, "id", None)
            opt_count = getattr(opt, "count", 0)
            if opt_id:
                uid = UUID(str(opt_id)) if not isinstance(opt_id, UUID) else opt_id
                provider_count_map[uid] = int(opt_count or 0)
                provider_ids_to_fetch.append(uid)

        department_count_map: dict[UUID, int] = {}
        department_ids_to_fetch: list[UUID] = []
        for opt in department_option_ids:
            opt_id = getattr(opt, "id", None)
            opt_count = getattr(opt, "count", 0)
            if opt_id:
                uid = UUID(str(opt_id)) if not isinstance(opt_id, UUID) else opt_id
                department_count_map[uid] = int(opt_count or 0)
                department_ids_to_fetch.append(uid)

        # Collect all provider IDs (from models + filter options)
        all_provider_ids = list(model_provider_ids | set(provider_ids_to_fetch))

        # Parallel fetch names from cached *_internal() functions
        providers_data = []
        departments_data = []

        pool = get_pool()
        has_ids = any([all_provider_ids, department_ids_to_fetch])

        if pool and has_ids:

            async def fetch_providers() -> list:
                if not all_provider_ids:
                    return []
                async with pool.acquire() as c:
                    return await get_providers_internal(
                        c, all_provider_ids, bypass_cache
                    )

            async def fetch_departments() -> list:
                if not department_ids_to_fetch:
                    return []
                async with pool.acquire() as c:
                    return await get_departments_internal(
                        c, department_ids_to_fetch, bypass_cache
                    )

            providers_data, departments_data = await asyncio.gather(
                fetch_providers(), fetch_departments()
            )

        # Build provider map for per-model enrichment
        provider_map: dict[UUID, Any] = {}
        for p in providers_data:
            p_id = getattr(p, "id", None)
            if p_id:
                uid = UUID(str(p_id)) if not isinstance(p_id, UUID) else p_id
                provider_map[uid] = p

        # Enrich models with provider names
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

        # Merge names with counts, apply search filtering in Python
        provider_search = request.provider_search
        providers: list[ListModelApiProvider] = [
            ListModelApiProvider(
                provider_id=p.id,
                name=p.name,
                count=provider_count_map.get(p.id, 0) if p.id else 0,
            )
            for p in providers_data
            if p.id
            and p.id in provider_count_map
            and (
                provider_search is None
                or provider_search.lower() in (p.name or "").lower()
            )
        ]

        department_search = request.department_search
        departments: list[ListModelApiDepartment] = [
            ListModelApiDepartment(
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

        # Build API response with computed permissions
        api_response = ListModelApiResponse(
            actor_name=actor_name,
            models=models_with_permissions,
            providers=providers,
            departments=departments,
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
