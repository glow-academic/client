"""Settings save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (setting_id = NULL) and update (setting_id provided).
"""

import uuid as uuid_mod
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.main.setting.permissions import compute_can_edit
from app.routes.v5.api.main.setting.types import (
    SaveSettingApiRequest,
    SaveSettingApiResponse,
    SaveSettingSqlParams,
    SaveSettingSqlRow,
    SettingMultiResourceAction,
    SettingResourceAction,
)
from app.routes.auth.profile import get_auth_profile_internal
from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import get_db, get_pool
from app.sql.types import (
    CheckSettingSaveAccessSqlParams,
    CheckSettingSaveAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/queries/settings/check_setting_save_access_complete.sql"
)
SQL_PATH = "app/sql/queries/settings/save_setting_complete.sql"

router = APIRouter()


async def save_setting_internal(
    conn: asyncpg.Connection,
    profile_id: uuid_mod.UUID,
    group_id: uuid_mod.UUID,
    resource_actions: dict[str, Any],
    setting_id: uuid_mod.UUID | None = None,
) -> uuid_mod.UUID | None:
    """Save a setting from resource actions dict (used by generation complete handler).

    Builds SaveSettingSqlParams from a flat resource_actions dict, executes the
    save SQL in a transaction, and invalidates cache.

    Returns the setting_id on success, None on failure.
    """
    try:

        def _single(key: str) -> SettingResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return SettingResourceAction(
                    resource_id=val.get("resource_id"),
                )
            return SettingResourceAction()

        def _multi(key: str) -> SettingMultiResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return SettingMultiResourceAction(
                    resource_ids=val.get("resource_ids"),
                )
            return SettingMultiResourceAction()

        params = SaveSettingSqlParams(
            profile_id=profile_id,
            input_setting_id=setting_id,
            group_id=group_id,
            names=_single("names"),
            descriptions=_single("descriptions"),
            flags=_single("flags"),
            colors=_multi("colors"),
            departments=_multi("departments"),
            profiles=_multi("profiles"),
            auths=_multi("auths"),
            provider_keys=_multi("provider_keys"),
            auth_item_keys=_multi("auth_item_keys"),
            roles=_multi("roles"),
        )

        async with conn.transaction():
            result = cast(
                SaveSettingSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.setting_id:
                return None

        await invalidate_tags(["settings"])
        return result.setting_id

    except Exception as e:
        logger.exception(f"save_setting_internal failed: {e}")
        return None


@router.post("/save", response_model=SaveSettingApiResponse)
async def save_setting(
    request: SaveSettingApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveSettingApiResponse:
    """Save setting - handles both create (setting_id = NULL) and update (setting_id provided)."""
    tags = ["settings"]  # From router tags

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
                    bypass_cache=False,
                )
                actor_name = profile_ctx.access.actor_name
                user_role = profile_ctx.access.role
                user_department_ids: list[UUID] = [
                    d.department_id for d in profile_ctx.departments if d.department_id
                ]
        else:
            actor_name = None
            user_role = None
            user_department_ids = []

        # Permission check: get setting department_ids using typed SQL
        access_params = CheckSettingSaveAccessSqlParams(
            profile_id=profile_id,
            setting_id=request.input_setting_id,
        )
        access_result = cast(
            CheckSettingSaveAccessSqlRow,
            await execute_sql_typed(
                conn,
                ACCESS_CHECK_SQL_PATH,
                params=access_params,
            ),
        )

        if not access_result:
            raise HTTPException(
                status_code=401,
                detail="Unable to verify user permissions.",
            )

        # Permission logic: create vs update mode
        if request.input_setting_id:
            # Update mode: check department access
            can_save = compute_can_edit(
                user_role=user_role,
                user_department_ids=user_department_ids,
                setting_department_ids=access_result.setting_department_ids or [],
            )
        else:
            # Create mode: any authenticated user can create
            can_save = user_role is not None

        if not can_save:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to save this setting.",
            )

        # Server-resolved group_id: create if not updating an existing setting
        group_id = None
        if not request.input_setting_id:
            group_id = await conn.fetchval(
                "INSERT INTO groups_entry (created_at, updated_at) VALUES (NOW(), NOW()) RETURNING id"
            )

        async with conn.transaction():
            # Convert API request to SQL params (add profile_id and group_id from server)
            params = SaveSettingSqlParams.from_request(request, profile_id, group_id)
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                SaveSettingSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.setting_id:
                if request.input_setting_id:
                    raise ValueError(f"Setting not found: {request.input_setting_id}")
                else:
                    raise ValueError("Failed to create setting")

        # Convert SQL result to API response
        api_response = SaveSettingApiResponse.model_validate(
            {
                "setting_id": str(result.setting_id),
                "actor_name": actor_name,
            }
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="save_setting",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
