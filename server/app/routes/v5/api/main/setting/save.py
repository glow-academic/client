"""Setting save endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.setting_save.
"""

from __future__ import annotations

import uuid as uuid_mod
from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.infra.setting_save import save_setting_client
from app.routes.v5.api.main.setting.types import (
    SaveSettingApiRequest,
    SaveSettingApiResponse,
    SaveSettingSqlParams,
    SaveSettingSqlRow,
    SettingMultiResourceAction,
    SettingResourceAction,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# SQL paths (kept for save_setting_internal legacy path)
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

        await invalidate_tags(["settings"], redis=get_redis_client())
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
    """Save settings using composable infra architecture."""
    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()

        response_data = await save_setting_client(
            conn,
            redis,
            profile_id=profile_id,
            items=request.settings,
            group_id=request.group_id,
        )

        response.headers["X-Invalidate-Tags"] = "settings"
        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="save_setting",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
