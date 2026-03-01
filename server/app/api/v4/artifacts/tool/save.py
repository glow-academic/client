"""Tool save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (tool_id = NULL) and update (tool_id provided).
"""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.tool.permissions import (
    compute_can_create,
    compute_can_edit,
)
from app.api.v4.artifacts.tool.types import (
    SaveToolApiRequest,
    SaveToolApiResponse,
    SaveToolSqlParams,
    SaveToolSqlRow,
    ToolMultiResourceAction,
    ToolResourceAction,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    CheckToolSaveAccessSqlParams,
    CheckToolSaveAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# SQL paths
ACCESS_CHECK_SQL_PATH = "app/sql/v4/queries/tools/check_tool_save_access_complete.sql"
SQL_PATH = "app/sql/v4/queries/tools/save_tool_complete.sql"

router = APIRouter()


async def save_tool_internal(
    conn: asyncpg.Connection,
    profile_id: uuid.UUID,
    group_id: uuid.UUID,
    resource_actions: dict[str, Any],
    tool_id: uuid.UUID | None = None,
) -> uuid.UUID | None:
    """Save a tool from resource actions dict (used by generation complete handler).

    Builds SaveToolSqlParams from a flat resource_actions dict, executes the
    save SQL in a transaction, and invalidates cache.

    Returns the tool_id on success, None on failure.
    """
    try:

        def _single(key: str) -> ToolResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return ToolResourceAction(
                    resource_id=val.get("resource_id"),
                )
            return ToolResourceAction()

        def _multi(key: str) -> ToolMultiResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return ToolMultiResourceAction(
                    resource_ids=val.get("resource_ids"),
                )
            return ToolMultiResourceAction()

        params = SaveToolSqlParams(
            profile_id=profile_id,
            input_tool_id=tool_id,
            group_id=group_id,
            names=_single("names"),
            descriptions=_single("descriptions"),
            flags=_single("flags"),
            args=_multi("args"),
            arg_positions=_multi("arg_positions"),
            args_outputs=_multi("args_outputs"),
        )

        async with conn.transaction():
            result = cast(
                SaveToolSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.tool_id:
                return None

        await invalidate_tags(["tools"])
        return result.tool_id

    except Exception as e:
        logger.exception(f"save_tool_internal failed: {e}")
        return None


@router.post("/save", response_model=SaveToolApiResponse)
async def save_tool(
    request: SaveToolApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveToolApiResponse:
    """Save tool - handles both create (tool_id = NULL) and update (tool_id provided)."""
    tags = ["tools"]

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
        else:
            actor_name = None
            user_role = None

        # Permission check: get user role and tool info using typed SQL
        access_params = CheckToolSaveAccessSqlParams(
            profile_id=profile_id,
            tool_id=request.input_tool_id,
        )
        access_result = cast(
            CheckToolSaveAccessSqlRow,
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
        if not request.input_tool_id:
            can_save_result = compute_can_create(
                user_role=user_role,
            )
        else:
            can_save_result = compute_can_edit(
                user_role=user_role,
                active_agent_count=access_result.active_usage_count or 0,
            )

        if not can_save_result:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to save this tool.",
            )

        async with conn.transaction():
            # Server-resolved group_id
            group_id = await conn.fetchval(
                "INSERT INTO groups_entry DEFAULT VALUES RETURNING id"
            )

            # Convert flat IDs to SQL params
            params = SaveToolSqlParams.from_request(
                request, profile_id=profile_id, group_id=group_id
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper
            result = cast(
                SaveToolSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.tool_id:
                if request.input_tool_id:
                    raise ValueError(f"Tool not found: {request.input_tool_id}")
                else:
                    raise ValueError("Failed to create tool")

        # Convert SQL result to API response
        is_update = request.input_tool_id is not None
        api_response = SaveToolApiResponse.model_validate(
            {
                "success": True,
                "tool_id": str(result.tool_id),
                "message": "Tool updated successfully"
                if is_update
                else "Tool created successfully",
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
            operation="save_tool",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
