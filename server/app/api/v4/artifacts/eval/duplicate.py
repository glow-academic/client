"""Eval duplicate endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.eval.permissions import compute_can_duplicate
from app.api.v4.artifacts.eval.types import (
    DuplicateEvalApiRequest,
    DuplicateEvalApiResponse,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    CheckEvalDuplicateAccessSqlParams,
    CheckEvalDuplicateAccessSqlRow,
    DuplicateEvalSqlParams,
    DuplicateEvalSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/v4/queries/evals/check_eval_duplicate_access_complete.sql"
)
DUPLICATE_SQL_PATH = "app/sql/v4/queries/evals/duplicate_eval_complete.sql"

router = APIRouter()


@router.post("/duplicate", response_model=DuplicateEvalApiResponse)
async def duplicate_eval(
    request: DuplicateEvalApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateEvalApiResponse:
    """Duplicate an eval."""
    tags = ["evals"]  # From router tags

    sql_query = load_sql_query(DUPLICATE_SQL_PATH)
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
        else:
            actor_name = None
            user_role = None

        # Permission check: get user role using typed SQL
        access_params = CheckEvalDuplicateAccessSqlParams(
            profile_id=profile_id,
        )
        access_result = cast(
            CheckEvalDuplicateAccessSqlRow,
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
                detail="You don't have permission to duplicate this eval.",
            )

        async with conn.transaction():
            # Convert API request to SQL params (add profile_id from header)
            params = DuplicateEvalSqlParams(
                **request.model_dump(), profile_id=profile_id
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper
            result = cast(
                DuplicateEvalSqlRow,
                await execute_sql_typed(
                    conn,
                    DUPLICATE_SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.new_eval_id:
                raise ValueError(f"Eval not found: {request.eval_id}")

            original_name = result.original_name or "Unknown"

            # Convert SQL result to API response
            api_response = DuplicateEvalApiResponse.model_validate(
                {
                    "success": True,
                    "eval_id": str(result.new_eval_id),
                    "message": f"Eval '{original_name}' duplicated successfully",
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
            operation="duplicate_eval",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
