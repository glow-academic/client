"""Auth duplicate endpoint - v4 API following DHH principles.
Uses access check SQL + Python permission logic before executing duplicate.
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.main.auth.permissions import compute_can_duplicate
from app.routes.v5.api.main.auth.types import (
    DuplicateAuthApiRequest,
    DuplicateAuthApiResponse,
)
from app.routes.auth.profile import get_auth_profile_internal
from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import get_db, get_pool
from app.sql.types import (
    CheckAuthDuplicateAccessSqlParams,
    CheckAuthDuplicateAccessSqlRow,
    DuplicateAuthSqlParams,
    DuplicateAuthSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/queries/auth/check_auth_duplicate_access_complete.sql"
)
DUPLICATE_SQL_PATH = "app/sql/queries/auth/duplicate_auth_complete.sql"

router = APIRouter()


@router.post("/duplicate", response_model=DuplicateAuthApiResponse)
async def duplicate_auth(
    request: DuplicateAuthApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateAuthApiResponse:
    """Duplicate an auth entry with all items and their key associations."""
    tags = ["auth"]

    sql_query = load_sql_query(DUPLICATE_SQL_PATH)
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

        # Permission check: verify auth exists using typed SQL
        access_params = CheckAuthDuplicateAccessSqlParams(
            profile_id=profile_id,
            auth_id=request.auth_id,
        )
        access_result = cast(
            CheckAuthDuplicateAccessSqlRow,
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

        if access_result.auth_exists is False:
            raise HTTPException(
                status_code=404,
                detail=f"Auth {request.auth_id} not found",
            )

        can_duplicate = compute_can_duplicate(user_role=user_role)

        if not can_duplicate:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to duplicate auth entries.",
            )

        async with conn.transaction():
            params = DuplicateAuthSqlParams(
                **request.model_dump(), profile_id=profile_id
            )
            sql_params = params.to_tuple()

            result = cast(
                DuplicateAuthSqlRow,
                await execute_sql_typed(
                    conn,
                    DUPLICATE_SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.auth_exists:
                raise HTTPException(
                    status_code=404,
                    detail=f"Auth {request.auth_id} not found",
                )

            original_name = result.original_name or "Unknown"

        # Build response
        api_response = DuplicateAuthApiResponse(
            success=True,
            auth_id=result.auth_id,
            message=f"Auth '{original_name}' duplicated successfully",
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
            operation="duplicate_auth",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
