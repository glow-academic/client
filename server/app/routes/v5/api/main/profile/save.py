"""Profile save endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.profile_save.
Legacy save_profile_internal kept for generation complete handler compatibility.
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.infra.profile_save import save_profile_client
from app.routes.v5.api.main.profile.types import (
    ProfileMultiResourceAction,
    ProfileResourceAction,
    SaveProfileApiRequest,
    SaveProfileApiResponse,
    SaveProfileSqlParams,
    SaveProfileSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# SQL paths (legacy — used by save_profile_internal only)
SQL_PATH = "app/sql/queries/profile/save_profile_complete.sql"

router = APIRouter()


async def save_profile_internal(
    conn: asyncpg.Connection,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None,
    resource_actions: dict[str, Any],
    input_profile_id: uuid.UUID | None = None,
) -> uuid.UUID | None:
    """Save a profile from resource actions dict (used by generation complete handler).

    Builds SaveProfileSqlParams from a flat resource_actions dict, executes the
    save SQL in a transaction, and invalidates cache.

    Returns the profile_id on success, None on failure.
    """
    try:

        def _single(key: str) -> ProfileResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return ProfileResourceAction(
                    resource_id=val.get("resource_id"),
                )
            return ProfileResourceAction()

        def _multi(key: str) -> ProfileMultiResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return ProfileMultiResourceAction(
                    resource_ids=val.get("resource_ids"),
                )
            return ProfileMultiResourceAction()

        params = SaveProfileSqlParams(
            profile_id=profile_id,
            input_profile_id=input_profile_id,
            group_id=group_id,
            role=resource_actions.get("role"),
            names=_single("names"),
            flags=_single("flags"),
            request_limits=_single("request_limits"),
            emails=_multi("emails"),
            departments=_multi("departments"),
        )

        async with conn.transaction():
            result = cast(
                SaveProfileSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.out_profile_id:
                return None

        await invalidate_tags(["profile"], redis=get_redis_client())
        return result.out_profile_id

    except Exception as e:
        logger.exception(f"save_profile_internal failed: {e}")
        return None


@router.post("/save", response_model=SaveProfileApiResponse)
async def save_profile(
    request: SaveProfileApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveProfileApiResponse:
    """Save profiles using composable infra architecture."""
    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()

        response_data = await save_profile_client(
            conn,
            redis,
            profile_id=profile_id,
            items=request.profiles,
            group_id=request.group_id,
        )

        response.headers["X-Invalidate-Tags"] = "profiles"
        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="save_profile",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
