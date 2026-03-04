"""Settings list endpoint."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_pool
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.v5.api.main.setting.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.routes.v5.api.main.setting.types import (
    ListSettingApiKey,
    ListSettingApiResponse,
    ListSettingApiSetting,
)
from app.sql.types import (
    GetSettingsListApiRequest,
    GetSettingsListSqlParams,
    GetSettingsListSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/queries/settings/get_settings_list_complete.sql"

router = APIRouter()


@router.post("/list", response_model=ListSettingApiResponse)
async def get_setting_list(
    request: GetSettingsListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListSettingApiResponse:
    """Get list of all settings ordered by created_at DESC."""
    tags = ["settings"]  # From router tags

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
            return ListSettingApiResponse.model_validate(cached["data"])

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
        params = GetSettingsListSqlParams(profile_id=profile_id)
        sql_params = params.to_tuple()

        # Execute query with typed helper - automatically detects and calls function if present
        result = cast(
            GetSettingsListSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Compute permissions for each setting in Python
        settings_with_permissions: list[ListSettingApiSetting] = []
        for setting in result.settings or []:
            can_edit_val = compute_can_edit(
                user_role=user_role,
                setting_department_ids=setting.department_ids,
                user_department_ids=user_department_ids,
            )
            can_delete_val = compute_can_delete(
                user_role=user_role,
                setting_department_ids=setting.department_ids,
            )
            can_duplicate_val = compute_can_duplicate(user_role)

            settings_with_permissions.append(
                ListSettingApiSetting(
                    settings_id=setting.settings_id,
                    created_at=setting.created_at,
                    active=setting.active,
                    name=setting.name,
                    description=setting.description,
                    department_ids=setting.department_ids,
                    can_edit=can_edit_val,
                    can_delete=can_delete_val,
                    can_duplicate=can_duplicate_val,
                )
            )

        # Map keys to handcrafted type
        keys: list[ListSettingApiKey] = [
            ListSettingApiKey(
                key_id=k.key_id,
                name=k.name,
                key_masked=k.key_masked,
                description=k.description,
                active=k.active,
                department_ids=k.department_ids,
            )
            for k in (result.keys or [])
        ]

        # Build API response with computed permissions
        api_response = ListSettingApiResponse(
            actor_name=actor_name,
            user_role=user_role,
            settings=settings_with_permissions,
            keys=keys,
        )

        # Cache response (use mode='json' to serialize UUIDs and other types)
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
            operation="get_setting_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
