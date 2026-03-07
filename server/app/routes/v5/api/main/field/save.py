"""Field save endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.field_save.
Legacy save_field_internal kept for generation complete handler compatibility.
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.field_save import save_field_client
from app.infra.globals import get_db, get_redis_client
from app.routes.v5.api.main.field.types import (
    FieldMultiResourceAction,
    FieldResourceAction,
    SaveFieldApiRequest,
    SaveFieldApiResponse,
    SaveFieldSqlParams,
    SaveFieldSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# SQL paths (legacy — used by save_field_internal only)
SQL_PATH = "app/sql/queries/fields/save_field_complete.sql"

router = APIRouter()


async def save_field_internal(
    conn: asyncpg.Connection,
    profile_id: uuid.UUID,
    group_id: uuid.UUID,
    resource_actions: dict[str, Any],
    field_id: uuid.UUID | None = None,
) -> uuid.UUID | None:
    """Save a field from resource actions dict (used by generation complete handler).

    Builds SaveFieldSqlParams from a flat resource_actions dict, executes the
    save SQL in a transaction, and invalidates cache.

    Returns the field_id on success, None on failure.
    """
    try:

        def _single(key: str) -> FieldResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return FieldResourceAction(
                    resource_id=val.get("resource_id"),
                )
            return FieldResourceAction()

        def _multi(key: str) -> FieldMultiResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return FieldMultiResourceAction(
                    resource_ids=val.get("resource_ids"),
                )
            return FieldMultiResourceAction()

        params = SaveFieldSqlParams(
            profile_id=profile_id,
            input_field_id=field_id,
            group_id=group_id,
            names=_single("names"),
            descriptions=_single("descriptions"),
            flags=_single("flags"),
            departments=_multi("departments"),
            conditional_parameters=_multi("conditional_parameters"),
        )

        async with conn.transaction():
            result = cast(
                SaveFieldSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.field_id:
                return None

        await invalidate_tags(["fields"], redis=get_redis_client())
        return result.field_id

    except Exception as e:
        logger.exception(f"save_field_internal failed: {e}")
        return None


@router.post("/save", response_model=SaveFieldApiResponse)
async def save_field(
    request: SaveFieldApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveFieldApiResponse:
    """Save fields using composable infra architecture."""
    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()

        response_data = await save_field_client(
            conn,
            redis,
            profile_id=profile_id,
            items=request.fields,
            group_id=request.group_id,
        )

        response.headers["X-Invalidate-Tags"] = "fields"
        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="save_field",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
