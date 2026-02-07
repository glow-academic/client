"""Providers list endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.provider.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.api.v4.artifacts.provider.types import (
    ListProviderApiProvider,
    ListProviderApiProviderOption,
    ListProviderApiResponse,
    ListProviderApiStatusOption,
)
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
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

    # Generate cache key from path and parsed body
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
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
        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        # Compute permissions per provider in Python
        user_role = result.user_role
        providers_list: list[ListProviderApiProvider] = []

        if result.providers:
            for p in result.providers:
                provider_dept_ids = p.department_ids or []
                model_usage = p.model_usage_count or 0

                providers_list.append(
                    ListProviderApiProvider(
                        provider_id=p.provider_id,
                        name=p.name,
                        description=p.description,
                        value=p.value,
                        active=p.active,
                        updated_at=p.updated_at,
                        model_usage_count=model_usage,
                        can_edit=compute_can_edit(
                            user_role=user_role,
                            provider_department_ids=provider_dept_ids,
                            model_usage_count=model_usage,
                        ),
                        can_delete=compute_can_delete(
                            user_role=user_role,
                            provider_department_ids=provider_dept_ids,
                            model_usage_count=model_usage,
                        ),
                        can_duplicate=compute_can_duplicate(user_role=user_role),
                    )
                )

        # Map provider options
        provider_options: list[ListProviderApiProviderOption] = []
        if result.provider_options:
            for opt in result.provider_options:
                provider_options.append(
                    ListProviderApiProviderOption(
                        value=opt.value,
                        label=opt.label,
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

        api_response = ListProviderApiResponse(
            actor_name=result.actor_name,
            providers=providers_list,
            provider_options=provider_options,
            status_options=status_options,
            total_count=len(providers_list),
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
