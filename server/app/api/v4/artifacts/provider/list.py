"""Providers list endpoint - v4 API following DHH principles.

Two-pass architecture:
1. SQL returns raw data with department_ids and model_usage_count
2. Python computes permissions (can_edit, can_delete, can_duplicate)

Filter option names hydrated from cached *_internal() functions.
"""

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.provider.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.api.v4.artifacts.provider.types import (
    ListProviderApiDepartment,
    ListProviderApiModel,
    ListProviderApiProvider,
    ListProviderApiProviderOption,
    ListProviderApiResponse,
    ListProviderApiStatusOption,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.models.get import get_models_internal
from app.api.v4.resources.providers.get import get_providers_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetProvidersListApiRequest,
    GetProvidersListSqlParams,
    GetProvidersListSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/providers/get_providers_list_complete.sql"


router = APIRouter()


@router.post(
    "/list",
    response_model=ListProviderApiResponse,
    dependencies=[
        audit_activity("providers.list", "{{ actor.name }} visited the Providers page")
    ],
)
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

        # Convert API request to SQL params (add profile_id from header)
        params = GetProvidersListSqlParams(profile_id=profile_id)
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

        # Set audit context
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        # user_role already fetched from context above
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
                        ),
                        can_delete=compute_can_delete(
                            user_role=user_role,
                            provider_department_ids=provider_dept_ids,
                            active_model_count=active_model_count,
                        ),
                        can_duplicate=compute_can_duplicate(user_role=user_role),
                    )
                )

        # Map status options
        status_options: list[ListProviderApiStatusOption] = []
        if result.status_options:
            for opt in result.status_options:
                status_options.append(
                    ListProviderApiStatusOption(
                        value=opt.value,
                        label=opt.label,
                    )
                )

        # --- Python hydration: filter option names from cached *_internal() ---
        # Extract option IDs and counts from SQL result
        provider_option_ids = getattr(result, "provider_option_ids", None) or []
        department_option_ids = getattr(result, "department_option_ids", None) or []
        model_option_ids = getattr(result, "model_option_ids", None) or []

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

        model_count_map: dict[UUID, int] = {}
        model_ids_to_fetch: list[UUID] = []
        for opt in model_option_ids:
            opt_id = getattr(opt, "id", None)
            opt_count = getattr(opt, "count", 0)
            if opt_id:
                uid = UUID(str(opt_id)) if not isinstance(opt_id, UUID) else opt_id
                model_count_map[uid] = int(opt_count or 0)
                model_ids_to_fetch.append(uid)

        # Parallel fetch names from cached *_internal() functions
        providers_data = []
        departments_data = []
        models_data = []

        pool = get_pool()
        has_ids = any(
            [provider_ids_to_fetch, department_ids_to_fetch, model_ids_to_fetch]
        )

        if pool and has_ids:

            async def fetch_providers() -> list:
                if not provider_ids_to_fetch:
                    return []
                async with pool.acquire() as c:
                    return await get_providers_internal(
                        c, provider_ids_to_fetch, bypass_cache
                    )

            async def fetch_departments() -> list:
                if not department_ids_to_fetch:
                    return []
                async with pool.acquire() as c:
                    return await get_departments_internal(
                        c, department_ids_to_fetch, bypass_cache
                    )

            async def fetch_models() -> list:
                if not model_ids_to_fetch:
                    return []
                async with pool.acquire() as c:
                    return await get_models_internal(
                        c, model_ids_to_fetch, bypass_cache
                    )

            providers_data, departments_data, models_data = await asyncio.gather(
                fetch_providers(), fetch_departments(), fetch_models()
            )

        # Merge names with counts
        # QGetProvidersV4Item uses .id (not .provider_id)
        provider_options: list[ListProviderApiProviderOption] = [
            ListProviderApiProviderOption(
                provider_id=p.id,
                name=p.name,
                description=p.description or "",
                count=provider_count_map.get(p.id, 0) if p.id else 0,
            )
            for p in providers_data
            if p.id
        ]

        # QGetDepartmentsV4Item uses .department_id
        departments: list[ListProviderApiDepartment] = [
            ListProviderApiDepartment(
                department_id=d.department_id,
                name=d.name,
                description=d.description or "",
                count=department_count_map.get(d.department_id, 0)
                if d.department_id
                else 0,
            )
            for d in departments_data
            if d.department_id
        ]

        # QGetModelsV4Item uses .id (not .model_id)
        models: list[ListProviderApiModel] = [
            ListProviderApiModel(
                model_id=m.id,
                name=m.name,
                description=m.description or "",
                count=model_count_map.get(m.id, 0) if m.id else 0,
            )
            for m in models_data
            if m.id
        ]

        api_response = ListProviderApiResponse(
            actor_name=actor_name,
            providers=providers_list,
            provider_options=provider_options,
            departments=departments,
            models=models,
            status_options=status_options,
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
