"""Department save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (department_id = NULL) and update (department_id provided).
"""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.department.permissions import (
    compute_can_create,
    compute_can_edit,
)
from app.v5.api.main.department.types import (
    DepartmentMultiResourceAction,
    DepartmentResourceAction,
    SaveDepartmentApiRequest,
    SaveDepartmentApiResponse,
    SaveDepartmentSqlParams,
    SaveDepartmentSqlRow,
)
from app.v5.api.auth.profile import get_auth_profile_internal
from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db, get_pool
from app.sql.types import (
    CheckDepartmentSaveAccessSqlParams,
    CheckDepartmentSaveAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/queries/departments/check_department_save_access_complete.sql"
)
SQL_PATH = "app/sql/queries/departments/save_department_complete.sql"

router = APIRouter()


async def save_department_internal(
    conn: asyncpg.Connection,
    profile_id: uuid.UUID,
    group_id: uuid.UUID,
    resource_actions: dict[str, Any],
    department_id: uuid.UUID | None = None,
) -> uuid.UUID | None:
    """Save a department from resource actions dict (used by generation complete handler).

    Builds SaveDepartmentSqlParams from a flat resource_actions dict, executes the
    save SQL in a transaction, and invalidates cache.

    Returns the department_id on success, None on failure.
    """
    try:

        def _single(key: str) -> DepartmentResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return DepartmentResourceAction(
                    resource_id=val.get("resource_id"),
                )
            return DepartmentResourceAction()

        def _multi(key: str) -> DepartmentMultiResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return DepartmentMultiResourceAction(
                    resource_ids=val.get("resource_ids"),
                )
            return DepartmentMultiResourceAction()

        params = SaveDepartmentSqlParams(
            profile_id=profile_id,
            input_department_id=department_id,
            group_id=group_id,
            names=_single("names"),
            descriptions=_single("descriptions"),
            flags=_single("flags"),
            settings=_multi("settings"),
        )

        async with conn.transaction():
            result = cast(
                SaveDepartmentSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.department_id:
                return None

        await invalidate_tags(["departments"])
        return result.department_id

    except Exception as e:
        logger.exception(f"save_department_internal failed: {e}")
        return None


@router.post("/save", response_model=SaveDepartmentApiResponse)
async def save_department(
    request: SaveDepartmentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveDepartmentApiResponse:
    """Save department - handles both create (department_id = NULL) and update (department_id provided)."""
    tags = ["departments"]

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
        else:
            actor_name = None
            user_role = None

        # Permission check: get user role and department info using typed SQL
        access_params = CheckDepartmentSaveAccessSqlParams(
            profile_id=profile_id,
            department_id=request.input_department_id,
        )
        access_result = cast(
            CheckDepartmentSaveAccessSqlRow,
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
        if not request.input_department_id:
            can_save_result = compute_can_create(
                user_role=user_role,
            )
        else:
            can_save_result = compute_can_edit(
                user_role=user_role,
                usage_count=access_result.department_usage_count or 0,
            )

        if not can_save_result:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to save this department.",
            )

        # Server-resolved group_id
        group_id = None
        if pool:
            async with pool.acquire() as group_conn:
                group_id = await group_conn.fetchval(
                    "INSERT INTO groups_entry (created_at, updated_at) VALUES (NOW(), NOW()) RETURNING id"
                )

        async with conn.transaction():
            params = SaveDepartmentSqlParams.from_request(
                request,
                profile_id=profile_id,
                group_id=group_id,
            )
            sql_params = params.to_tuple()

            result = cast(
                SaveDepartmentSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.department_id:
                if request.input_department_id:
                    raise ValueError(
                        f"Department not found: {request.input_department_id}"
                    )
                else:
                    raise ValueError("Failed to create department")

        # Convert SQL result to API response
        is_update = request.input_department_id is not None
        api_response = SaveDepartmentApiResponse(
            success=True,
            department_id=result.department_id,
            message="Department updated successfully"
            if is_update
            else "Department created successfully",
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        # Trigger Keycloak sync for the department
        from app.v5.infra.auth.keycloak_sync import perform_keycloak_sync

        await perform_keycloak_sync(department_id=str(result.department_id))

        return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="save_department",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
