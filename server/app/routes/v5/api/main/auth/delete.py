"""Auth delete endpoint - v4 API following DHH principles.
Uses access check SQL + Python permission logic before executing delete.
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.main.auth.permissions import compute_can_delete
from app.routes.v5.api.main.auth.types import (
    DeleteAuthApiRequest,
    DeleteAuthApiResponse,
)
from app.routes.auth.profile import get_auth_profile_internal
from app.infra.auth.keycloak_sync import perform_keycloak_sync
from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db, get_pool
from app.sql.types import (
    CheckAuthDeleteAccessSqlParams,
    CheckAuthDeleteAccessSqlRow,
    DeleteAuthSqlParams,
    DeleteAuthSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = "app/sql/queries/auth/check_auth_delete_access_complete.sql"
DELETE_SQL_PATH = "app/sql/queries/auth/delete_auth_complete.sql"

router = APIRouter()


@router.post("/delete", response_model=DeleteAuthApiResponse)
async def delete_auth(
    request: DeleteAuthApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteAuthApiResponse:
    """Delete an auth entry."""
    tags = ["auth"]

    sql_query = load_sql_query(DELETE_SQL_PATH)
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
        access_params = CheckAuthDeleteAccessSqlParams(
            profile_id=profile_id,
            auth_id=request.auth_id,
        )
        access_result = cast(
            CheckAuthDeleteAccessSqlRow,
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

        # Check auth exists
        if access_result.auth_exists is False:
            raise HTTPException(
                status_code=404,
                detail=f"Auth {request.auth_id} not found",
            )

        # Permission check using centralized permissions logic
        can_delete = compute_can_delete(
            user_role=user_role,
            active_settings_count=access_result.active_settings_count or 0,
        )

        if not can_delete:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to delete this auth entry.",
            )

        async with conn.transaction():
            params = DeleteAuthSqlParams(**request.model_dump(), profile_id=profile_id)
            sql_params = params.to_tuple()

            result = cast(
                DeleteAuthSqlRow,
                await execute_sql_typed(
                    conn,
                    DELETE_SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.auth_exists:
                raise HTTPException(
                    status_code=404, detail=f"Auth {request.auth_id} not found"
                )

        # Build response
        api_response = DeleteAuthApiResponse(
            success=True,
            message=f"Auth '{result.name or 'Unknown'}' deleted successfully",
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
            operation="delete_auth",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
