"""Auth save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (auth_id = NULL) and update (auth_id provided).
Uses access check SQL + Python permission logic before executing save.
"""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.auth.permissions import (
    compute_can_create,
    compute_can_edit,
)
from app.v5.api.main.auth.types import (
    AuthItemAction,
    AuthMultiResourceAction,
    AuthResourceAction,
    SaveAuthApiRequest,
    SaveAuthApiResponse,
    SaveAuthSqlParams,
    SaveAuthSqlRow,
)
from app.v5.api.auth.profile import get_auth_profile_internal
from app.v5.infra.auth.keycloak_sync import perform_keycloak_sync
from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.v5.sql.types import (
    CheckAuthSaveAccessSqlParams,
    CheckAuthSaveAccessSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.invalidate_tags import invalidate_tags
from app.v5.utils.logging.db_logger import get_logger
from app.v5.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# SQL paths
ACCESS_CHECK_SQL_PATH = "app/v5/sql/queries/auth/check_auth_save_access_complete.sql"
SQL_PATH = "app/v5/sql/queries/auth/save_auth_complete.sql"

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

        await invalidate_tags(["auth"])
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
    """Save auth - handles both create (auth_id = NULL) and update (auth_id provided)."""
    tags = ["auth"]

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

        # Permission check: get user role using typed SQL
        access_params = CheckAuthSaveAccessSqlParams(
            profile_id=profile_id,
            auth_id=request.input_auth_id,
        )
        access_result = cast(
            CheckAuthSaveAccessSqlRow,
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
        if not request.input_auth_id:
            can_save_result = compute_can_create(user_role=user_role)
        else:
            can_save_result = compute_can_edit(user_role=user_role)

        if not can_save_result:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to save this auth entry.",
            )

        # Server-resolved group_id
        group_id = None
        if pool:
            async with pool.acquire() as group_conn:
                group_id = await group_conn.fetchval(
                    "INSERT INTO groups_entry (created_at, updated_at) VALUES (NOW(), NOW()) RETURNING id"
                )

        async with conn.transaction():
            params = SaveAuthSqlParams.from_request(
                request, profile_id=profile_id, group_id=group_id
            )
            sql_params = params.to_tuple()

            result = cast(
                SaveAuthSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.auth_id:
                if request.input_auth_id:
                    raise ValueError(f"Auth not found: {request.input_auth_id}")
                else:
                    raise ValueError("Failed to create auth")

        # Build response
        is_update = request.input_auth_id is not None
        api_response = SaveAuthApiResponse(
            success=True,
            auth_id=result.auth_id,
            message="Auth updated successfully"
            if is_update
            else "Auth created successfully",
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        # Trigger Keycloak sync (fire-and-forget)
        await perform_keycloak_sync(department_id=None)

        return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="save_auth",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
