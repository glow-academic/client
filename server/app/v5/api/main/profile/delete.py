"""Profile delete endpoint - two-pass architecture with Python permissions."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.profile.permissions import compute_can_delete
from app.v5.api.main.profile.types import (
    DeleteProfileApiRequest,
    DeleteProfileApiResponse,
)
from app.v5.api.auth.profile import get_auth_profile_internal
from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db, get_pool
from app.sql.types import (
    CheckProfileDeleteAccessSqlParams,
    CheckProfileDeleteAccessSqlRow,
    DeleteProfileSqlParams,
    DeleteProfileSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/queries/profile/check_profile_delete_access_complete.sql"
)
DELETE_SQL_PATH = "app/sql/queries/profile/delete_profile_complete.sql"

router = APIRouter()


@router.post("/delete", response_model=DeleteProfileApiResponse)
async def delete_profile(
    request: DeleteProfileApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteProfileApiResponse:
    """Delete a profile."""
    tags = ["profile"]

    sql_query = load_sql_query(DELETE_SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        current_profile_id = http_request.state.profile_id
        if not current_profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                profile_ctx = await get_auth_profile_internal(
                    conn=context_conn,
                    profile_id=current_profile_id,
                    bypass_cache=False,
                )
                actor_name = profile_ctx.access.actor_name
                user_role = profile_ctx.access.role
        else:
            actor_name = None
            user_role = None

        # Permission check: get user role and target profile info
        access_params = CheckProfileDeleteAccessSqlParams(
            profile_id=current_profile_id,
            target_profile_id=request.target_profile_id,
        )
        access_result = cast(
            CheckProfileDeleteAccessSqlRow,
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

        can_delete = compute_can_delete(
            user_role=user_role,
            target_is_self=access_result.target_is_self or False,
            target_role=getattr(access_result, "target_role", None),
        )

        if not can_delete:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to delete this profile.",
            )

        async with conn.transaction():
            params = DeleteProfileSqlParams(
                **request.model_dump(), current_profile_id=current_profile_id
            )
            sql_params = params.to_tuple()

            result = cast(
                DeleteProfileSqlRow,
                await execute_sql_typed(
                    conn,
                    DELETE_SQL_PATH,
                    params=params,
                ),
            )

            if not result.profile_exists:
                raise HTTPException(
                    status_code=404,
                    detail=f"Profile not found: {request.target_profile_id}",
                )

            if not result.deleted:
                raise HTTPException(status_code=500, detail="Failed to delete profile")

            profile_name = access_result.profile_name or result.name or "Unknown"

        api_response = DeleteProfileApiResponse.model_validate(
            {
                "success": True,
                "message": f"Profile '{profile_name}' deleted successfully",
            }
        )

        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_profile",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
