"""Parameter save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (parameter_id = NULL) and update (parameter_id provided).
"""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.parameter.permissions import (
    compute_can_create,
    compute_can_edit,
)
from app.v5.api.main.parameter.types import (
    ParameterMultiResourceAction,
    ParameterResourceAction,
    SaveParameterApiRequest,
    SaveParameterApiResponse,
    SaveParameterSqlParams,
    SaveParameterSqlRow,
)
from app.v5.api.auth.profile import get_auth_profile_internal
from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.v5.sql.types import (
    CheckParameterSaveAccessSqlParams,
    CheckParameterSaveAccessSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.invalidate_tags import invalidate_tags
from app.v5.utils.logging.db_logger import get_logger
from app.v5.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/v5/sql/queries/parameters/check_parameter_save_access_complete.sql"
)
SQL_PATH = "app/v5/sql/queries/parameters/save_parameter_complete.sql"

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

        await invalidate_tags(["parameters", "agents"])
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
    """Save parameter - handles both create (parameter_id = NULL) and update (parameter_id provided)."""
    tags = ["parameters", "agents"]  # Parameters used in scenario generation

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
                user_department_ids = [
                    d.department_id for d in profile_ctx.departments if d.department_id
                ]
        else:
            actor_name = None
            user_role = None
            user_department_ids = []

        # Permission check: get user role and parameter info using typed SQL
        access_params = CheckParameterSaveAccessSqlParams(
            profile_id=profile_id,
            parameter_id=request.input_parameter_id,
        )
        access_result = cast(
            CheckParameterSaveAccessSqlRow,
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
        if not request.input_parameter_id:
            # Create mode: check role and department permissions
            can_save_result = compute_can_create(
                user_role=user_role,
                department_ids=request.department_ids,
            )
        else:
            # Update mode: full permission check including user department membership
            can_save_result = compute_can_edit(
                user_role=user_role,
                parameter_department_ids=access_result.parameter_department_ids,
                active_scenario_count=access_result.active_scenario_count or 0,
                user_department_ids=user_department_ids,
            )

        if not can_save_result:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to save this parameter.",
            )

        # Create group_id in Python (server-resolved like persona)
        group_id = None
        if pool:
            async with pool.acquire() as group_conn:
                group_id = await group_conn.fetchval(
                    "INSERT INTO groups_entry (created_at, updated_at) VALUES (NOW(), NOW()) RETURNING id"
                )

        async with conn.transaction():
            params = SaveParameterSqlParams.from_request(
                request,
                profile_id=profile_id,
                group_id=group_id,
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                SaveParameterSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.parameter_id:
                if request.input_parameter_id:
                    raise ValueError(
                        f"Parameter not found: {request.input_parameter_id}"
                    )
                else:
                    raise ValueError("Failed to create parameter")

        # Convert SQL result to API response
        is_update = request.input_parameter_id is not None
        api_response = SaveParameterApiResponse.model_validate(
            {
                "success": True,
                "parameter_id": str(result.parameter_id),
                "message": "Parameter updated successfully"
                if is_update
                else "Parameter created successfully",
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
            operation="save_parameter",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
