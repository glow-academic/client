"""Profile save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (input_profile_id = NULL) and update (input_profile_id provided).
Uses two-pass architecture: access check SQL → Python permissions → mutation SQL.
"""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.main.profile.permissions import (
    compute_can_create,
    compute_can_edit,
)
from app.routes.v5.api.main.profile.types import (
    ProfileMultiResourceAction,
    ProfileResourceAction,
    SaveProfileRouteApiRequest,
    SaveProfileRouteApiResponse,
    SaveProfileSqlParams,
    SaveProfileSqlRow,
)
from app.routes.auth.profile import get_auth_profile_internal
from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import get_db, get_pool
from app.sql.types import (
    CheckProfileSaveAccessSqlParams,
    CheckProfileSaveAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/queries/profile/check_profile_save_access_complete.sql"
)
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

        await invalidate_tags(["profile"])
        return result.out_profile_id

    except Exception as e:
        logger.exception(f"save_profile_internal failed: {e}")
        return None


@router.post("/save", response_model=SaveProfileRouteApiResponse)
async def save_profile(
    request: SaveProfileRouteApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveProfileRouteApiResponse:
    """Save profile - handles both create and update via resource action composites."""
    tags = ["profile"]

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

        # Permission check: get user role and department info
        access_params = CheckProfileSaveAccessSqlParams(
            profile_id=profile_id,
            input_profile_id=request.input_profile_id,
        )
        access_result = cast(
            CheckProfileSaveAccessSqlRow,
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
        if not request.input_profile_id:
            can_save_result = compute_can_create(
                user_role=user_role,
                department_ids=None,
            )
        else:
            can_save_result = compute_can_edit(
                user_role=user_role,
                target_is_self=access_result.target_is_self or False,
                target_department_ids=access_result.target_department_ids,
                user_department_ids=user_department_ids,
            )

        if not can_save_result:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to save this profile.",
            )

        # Server-resolved group_id: create if not updating an existing profile
        group_id = None
        if not request.input_profile_id:
            group_id = await conn.fetchval(
                "INSERT INTO groups_entry (created_at, updated_at) VALUES (NOW(), NOW()) RETURNING id"
            )

        async with conn.transaction():
            # Convert flat resource IDs to SQL params
            params = SaveProfileSqlParams.from_request(
                request, profile_id=profile_id, group_id=group_id
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper
            result = cast(
                SaveProfileSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.out_profile_id:
                if request.input_profile_id:
                    raise ValueError(f"Profile not found: {request.input_profile_id}")
                else:
                    raise ValueError("Failed to create profile")

        # Convert SQL result to API response
        api_response = SaveProfileRouteApiResponse.model_validate(
            {
                "profile_id": str(result.out_profile_id),
                "actor_name": actor_name,
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
            operation="save_profile",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
