"""Eval save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (eval_id = NULL) and update (eval_id provided).
"""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.eval.permissions import (
    compute_can_create,
    compute_can_edit,
)
from app.v5.api.main.eval.types import (
    SaveEvalApiRequest,
    SaveEvalApiResponse,
    SaveEvalSqlParams,
    SaveEvalSqlRow,
)
from app.v5.api.auth.profile import get_auth_profile_internal
from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.v5.sql.types import (
    CheckEvalSaveAccessSqlParams,
    CheckEvalSaveAccessSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.invalidate_tags import invalidate_tags
from app.v5.utils.logging.db_logger import get_logger
from app.v5.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# SQL paths
ACCESS_CHECK_SQL_PATH = "app/v5/sql/queries/evals/check_eval_save_access_complete.sql"
SQL_PATH = "app/v5/sql/queries/evals/save_eval_complete.sql"

router = APIRouter()


async def save_eval_internal(
    conn: asyncpg.Connection,
    profile_id: uuid.UUID,
    group_id: uuid.UUID,
    resource_actions: dict[str, Any],
    eval_id: uuid.UUID | None = None,
) -> uuid.UUID | None:
    """Save an eval from resource actions dict (used by generation complete handler).

    Builds SaveEvalSqlParams from a flat resource_actions dict, executes the
    save SQL in a transaction, and invalidates cache.

    Returns the eval_id on success, None on failure.
    """
    try:

        def _single_id(key: str) -> uuid.UUID | None:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                rid = val.get("resource_id")
                if rid:
                    return uuid.UUID(rid) if isinstance(rid, str) else rid
            return None

        def _multi_ids(key: str) -> list[uuid.UUID] | None:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                rids = val.get("resource_ids")
                if rids:
                    return [uuid.UUID(r) if isinstance(r, str) else r for r in rids]
            return None

        name_id = _single_id("names")
        if not name_id:
            return None

        params = SaveEvalSqlParams(
            profile_id=profile_id,
            group_id=group_id,
            input_eval_id=eval_id,
            name_id=name_id,
            description_id=_single_id("descriptions"),
            flag_ids=_multi_ids("flags"),
            department_ids=_multi_ids("departments"),
            rubric_ids=_multi_ids("rubrics"),
            model_ids=_multi_ids("models"),
            model_flag_ids=_multi_ids("model_flags"),
            model_rubric_ids=_multi_ids("model_rubrics"),
            model_position_ids=_multi_ids("model_positions"),
        )

        async with conn.transaction():
            result = cast(
                SaveEvalSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.eval_id:
                return None

        await invalidate_tags(["evals"])

        # Sync benchmark entries (fire-and-forget — failure should not fail the save)
        try:
            from app.v5.api.main.eval.sync import sync_benchmark_entries

            await sync_benchmark_entries(
                conn=conn,
                evals_resource_id=result.eval_id,
                model_ids=params.model_ids or [],
                model_flag_ids=params.model_flag_ids or [],
                model_rubric_ids=params.model_rubric_ids or [],
                model_position_ids=params.model_position_ids or [],
                department_ids=params.department_ids or [],
            )
        except Exception as sync_err:
            logger.warning(f"sync_benchmark_entries failed (non-fatal): {sync_err}")

        return result.eval_id

    except Exception as e:
        logger.exception(f"save_eval_internal failed: {e}")
        return None


@router.post("/save", response_model=SaveEvalApiResponse)
async def save_eval(
    request: SaveEvalApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveEvalApiResponse:
    """Save eval - handles both create (eval_id = NULL) and update (eval_id provided)."""
    tags = ["evals"]  # From router tags

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

        # Permission check: get user role and eval info using typed SQL
        access_params = CheckEvalSaveAccessSqlParams(
            profile_id=profile_id,
            eval_id=request.input_eval_id,
        )
        access_result = cast(
            CheckEvalSaveAccessSqlRow,
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
        if not request.input_eval_id:
            can_save_result = compute_can_create(user_role=user_role)
        else:
            can_save_result = compute_can_edit(user_role=user_role)

        if not can_save_result:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to save this eval.",
            )

        # Server-resolved group_id
        group_id = None
        if pool:
            async with pool.acquire() as group_conn:
                group_id = await group_conn.fetchval(
                    "INSERT INTO groups_entry (created_at, updated_at) VALUES (NOW(), NOW()) RETURNING id"
                )

        async with conn.transaction():
            # Convert API request to SQL params (add profile_id from header)
            params = SaveEvalSqlParams.from_request(
                request=request,
                profile_id=profile_id,
                group_id=group_id,
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper
            result = cast(
                SaveEvalSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.eval_id:
                if request.input_eval_id:
                    raise ValueError(f"Eval not found: {request.input_eval_id}")
                else:
                    raise ValueError("Failed to create eval")

        # Convert SQL result to API response
        is_update = request.input_eval_id is not None
        api_response = SaveEvalApiResponse.model_validate(
            {
                "success": True,
                "eval_id": str(result.eval_id),
                "message": "Eval updated successfully"
                if is_update
                else "Eval created successfully",
            }
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        # Sync benchmark entries (fire-and-forget — failure should not fail the save)
        try:
            from app.v5.api.main.eval.sync import sync_benchmark_entries

            await sync_benchmark_entries(
                conn=conn,
                evals_resource_id=result.eval_id,
                model_ids=request.model_ids or [],
                model_flag_ids=request.model_flag_ids or [],
                model_rubric_ids=request.model_rubric_ids or [],
                model_position_ids=request.model_position_ids or [],
                department_ids=request.department_ids or [],
            )
        except Exception as sync_err:
            logger.warning(f"sync_benchmark_entries failed (non-fatal): {sync_err}")

        return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="save_eval",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
