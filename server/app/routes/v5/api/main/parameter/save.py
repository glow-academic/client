"""Parameter save endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.parameter_save.
Legacy save_parameter_internal kept for generation complete handler compatibility.
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.infra.parameter_save import save_parameter_client
from app.routes.v5.api.main.parameter.types import (
    ParameterMultiResourceAction,
    ParameterResourceAction,
    SaveParameterApiRequest,
    SaveParameterApiResponse,
    SaveParameterSqlParams,
    SaveParameterSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# SQL paths (legacy — used by save_parameter_internal only)
SQL_PATH = "app/sql/queries/parameters/save_parameter_complete.sql"

router = APIRouter()


async def save_parameter_internal(
    conn: asyncpg.Connection,
    profile_id: uuid.UUID,
    group_id: uuid.UUID,
    resource_actions: dict[str, Any],
    parameter_id: uuid.UUID | None = None,
) -> uuid.UUID | None:
    """Save a parameter from resource actions dict (used by generation complete handler).

    Builds SaveParameterSqlParams from a flat resource_actions dict, executes the
    save SQL in a transaction, and invalidates cache.

    Returns the parameter_id on success, None on failure.
    """
    try:

        def _single(key: str) -> ParameterResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return ParameterResourceAction(
                    resource_id=val.get("resource_id"),
                )
            return ParameterResourceAction()

        def _multi(key: str) -> ParameterMultiResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return ParameterMultiResourceAction(
                    resource_ids=val.get("resource_ids"),
                )
            return ParameterMultiResourceAction()

        params = SaveParameterSqlParams(
            profile_id=profile_id,
            input_parameter_id=parameter_id,
            group_id=group_id,
            names=_single("names"),
            descriptions=_single("descriptions"),
            flags=_multi("flags"),
            departments=_multi("departments"),
            fields=_multi("fields"),
        )

        async with conn.transaction():
            result = cast(
                SaveParameterSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.parameter_id:
                return None

        await invalidate_tags(["parameters", "agents"], redis=get_redis_client())
        return result.parameter_id

    except Exception as e:
        logger.exception(f"save_parameter_internal failed: {e}")
        return None


@router.post("/save", response_model=SaveParameterApiResponse)
async def save_parameter(
    request: SaveParameterApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveParameterApiResponse:
    """Save parameters using composable infra architecture."""
    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()

        response_data = await save_parameter_client(
            conn,
            redis,
            profile_id=profile_id,
            items=request.parameters,
            group_id=request.group_id,
        )

        response.headers["X-Invalidate-Tags"] = "parameters"
        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="save_parameter",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
