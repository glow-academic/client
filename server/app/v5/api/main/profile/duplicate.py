"""Profile duplicate endpoint - two-pass architecture with Python permissions."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.profile.permissions import compute_can_duplicate
from app.v5.api.main.profile.types import (
    DuplicateProfileApiRequest,
    DuplicateProfileApiResponse,
)
from app.v5.api.auth.profile import get_auth_profile_internal
from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.v5.sql.types import (
    CheckProfileDuplicateAccessSqlParams,
    CheckProfileDuplicateAccessSqlRow,
    DuplicateProfileSqlParams,
    DuplicateProfileSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.invalidate_tags import invalidate_tags
from app.v5.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/v5/sql/queries/profile/check_profile_duplicate_access_complete.sql"
)
DUPLICATE_SQL_PATH = "app/v5/sql/queries/profile/duplicate_profile_complete.sql"

router = APIRouter()


@router.post("/duplicate", response_model=DuplicateProfileApiResponse)
async def duplicate_profile(
    request: DuplicateProfileApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateProfileApiResponse:
    """Duplicate a profile."""
    tags = ["profile"]

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

        # Permission check: get user role
        access_params = CheckProfileDuplicateAccessSqlParams(
            profile_id=profile_id,
        )
        access_result = cast(
            CheckProfileDuplicateAccessSqlRow,
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

        can_duplicate = compute_can_duplicate(user_role=user_role)

        if not can_duplicate:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to duplicate this profile.",
            )

        async with conn.transaction():
            params = DuplicateProfileSqlParams(
                **request.model_dump(), profile_id=profile_id
            )
            sql_params = params.to_tuple()

            result = cast(
                DuplicateProfileSqlRow,
                await execute_sql_typed(
                    conn,
                    DUPLICATE_SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.new_profile_id:
                raise ValueError(f"Profile not found: {request.target_profile_id}")

            original_name = result.original_name or "Unknown"

        api_response = DuplicateProfileApiResponse.model_validate(
            {
                "success": True,
                "profile_id": str(result.new_profile_id),
                "message": f"Profile '{original_name}' duplicated successfully",
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
            operation="duplicate_profile",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
