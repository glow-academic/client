"""Auth save endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.auth_save.
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.auth_save import save_auth_client
from app.infra.globals import get_db, get_redis_client
from app.routes.v5.api.main.auth.types import (
    AuthItemAction,
    AuthMultiResourceAction,
    AuthResourceAction,
    SaveAuthApiRequest,
    SaveAuthApiResponse,
    SaveAuthSqlParams,
    SaveAuthSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# SQL paths (kept for save_auth_internal legacy path)
SQL_PATH = "app/sql/queries/auth/save_auth_complete.sql"

router = APIRouter()


async def save_auth_internal(
    conn: asyncpg.Connection,
    profile_id: uuid.UUID,
    group_id: uuid.UUID,
    resource_actions: dict[str, Any],
    auth_id: uuid.UUID | None = None,
) -> uuid.UUID | None:
    """Save an auth from resource actions dict (used by generation complete handler).

    Builds SaveAuthSqlParams from a flat resource_actions dict, executes the
    save SQL in a transaction, and invalidates cache.

    Returns the auth_id on success, None on failure.
    """
    try:

        def _single(key: str) -> AuthResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return AuthResourceAction(
                    resource_id=val.get("resource_id"),
                )
            return AuthResourceAction()

        def _multi(key: str) -> AuthMultiResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return AuthMultiResourceAction(
                    resource_ids=val.get("resource_ids"),
                )
            return AuthMultiResourceAction()

        params = SaveAuthSqlParams(
            profile_id=profile_id,
            input_auth_id=auth_id,
            group_id=group_id,
            names=_single("names"),
            descriptions=_single("descriptions"),
            flags=_single("flags"),
            protocols=_multi("protocols"),
            slugs=_multi("slugs"),
            items=AuthItemAction(),
        )

        async with conn.transaction():
            result = cast(
                SaveAuthSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.auth_id:
                return None

        await invalidate_tags(["auth"], redis=get_redis_client())
        return result.auth_id

    except Exception as e:
        logger.exception(f"save_auth_internal failed: {e}")
        return None


@router.post("/save", response_model=SaveAuthApiResponse)
async def save_auth(
    request: SaveAuthApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveAuthApiResponse:
    """Save auths using composable infra architecture."""
    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()

        response_data = await save_auth_client(
            conn,
            redis,
            profile_id=profile_id,
            items=request.auths,
            group_id=request.group_id,
        )

        response.headers["X-Invalidate-Tags"] = "auths"
        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="save_auth",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
