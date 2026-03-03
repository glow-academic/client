"""Rubric save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (rubric_id = NULL) and update (rubric_id provided).
"""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.main.rubric.permissions import (
    compute_can_create,
    compute_can_edit,
)
from app.routes.v5.api.main.rubric.types import (
    RubricMultiResourceAction,
    RubricResourceAction,
    SaveRubricApiRequest,
    SaveRubricApiResponse,
    SaveRubricSqlParams,
    SaveRubricSqlRow,
)
from app.routes.auth.profile import get_auth_profile_internal
from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import get_db, get_pool
from app.sql.types import (
    CheckRubricSaveAccessSqlParams,
    CheckRubricSaveAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/queries/rubrics/check_rubric_save_access_complete.sql"
)
SQL_PATH = "app/sql/queries/rubrics/save_rubric_complete.sql"

router = APIRouter()


async def save_rubric_internal(
    conn: asyncpg.Connection,
    profile_id: uuid.UUID,
    group_id: uuid.UUID,
    resource_actions: dict[str, Any],
    rubric_id: uuid.UUID | None = None,
) -> uuid.UUID | None:
    """Save a rubric from resource actions dict (used by generation complete handler).

    Builds SaveRubricSqlParams from a flat resource_actions dict, executes the
    save SQL in a transaction, and invalidates cache.

    Returns the rubric_id on success, None on failure.
    """
    try:

        def _single(key: str) -> RubricResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return RubricResourceAction(
                    resource_id=val.get("resource_id"),
                )
            return RubricResourceAction()

        def _multi(key: str) -> RubricMultiResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return RubricMultiResourceAction(
                    resource_ids=val.get("resource_ids"),
                )
            return RubricMultiResourceAction()

        params = SaveRubricSqlParams(
            profile_id=profile_id,
            input_rubric_id=rubric_id,
            group_id=group_id,
            names=_single("names"),
            descriptions=_single("descriptions"),
            flags=_single("flags"),
            departments=_multi("departments"),
            points=_single("points"),
            pass_points=_single("pass_points"),
            standard_groups=_multi("standard_groups"),
            standards=_multi("standards"),
        )

        async with conn.transaction():
            result = cast(
                SaveRubricSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.rubric_id:
                return None

        await invalidate_tags(["rubrics"])
        return result.rubric_id

    except Exception as e:
        logger.exception(f"save_rubric_internal failed: {e}")
        return None


@router.post("/save", response_model=SaveRubricApiResponse)
async def save_rubric(
    request: SaveRubricApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveRubricApiResponse:
    """Save rubric - handles both create (rubric_id = NULL) and update (rubric_id provided)."""
    tags = ["rubrics"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
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

        # Permission check: get user role and rubric info using typed SQL
        access_params = CheckRubricSaveAccessSqlParams(
            profile_id=profile_id,
            rubric_id=request.input_rubric_id,
        )
        access_result = cast(
            CheckRubricSaveAccessSqlRow,
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
        if not request.input_rubric_id:
            can_save_result = compute_can_create(
                user_role=user_role,
                department_ids=None,
            )
        else:
            can_save_result = compute_can_edit(
                user_role=user_role,
                rubric_department_ids=access_result.rubric_department_ids,
                active_simulation_count=access_result.active_simulation_count or 0,
            )

        if not can_save_result:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to save this rubric.",
            )

        # Server-resolved group_id
        group_id = None
        if pool:
            async with pool.acquire() as group_conn:
                group_id = await group_conn.fetchval(
                    "INSERT INTO groups_entry (created_at, updated_at) VALUES (NOW(), NOW()) RETURNING id"
                )

        async with conn.transaction():
            params = SaveRubricSqlParams.from_request(
                request, profile_id=profile_id, group_id=group_id
            )
            sql_params = params.to_tuple()

            result = cast(
                SaveRubricSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.rubric_id:
                if request.input_rubric_id:
                    raise ValueError(f"Rubric not found: {request.input_rubric_id}")
                else:
                    raise ValueError("Failed to create rubric")

        is_update = request.input_rubric_id is not None
        api_response = SaveRubricApiResponse.model_validate(
            {
                "success": True,
                "rubric_id": str(result.rubric_id),
                "message": "Rubric updated successfully"
                if is_update
                else "Rubric created successfully",
            }
        )

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
            operation="save_rubric",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
