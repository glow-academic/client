"""Rubric duplicate endpoint - v4 API."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_pool
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.v5.api.main.rubric.permissions import compute_can_duplicate
from app.routes.v5.api.main.rubric.types import (
    DuplicateRubricApiRequest,
    DuplicateRubricApiResponse,
)
from app.sql.types import (
    CheckRubricDuplicateAccessSqlParams,
    CheckRubricDuplicateAccessSqlRow,
    DuplicateRubricSqlParams,
    DuplicateRubricSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/queries/rubrics/check_rubric_duplicate_access_complete.sql"
)
DUPLICATE_SQL_PATH = "app/sql/queries/rubric/duplicate_rubric_complete.sql"

router = APIRouter()


@router.post("/duplicate", response_model=DuplicateRubricApiResponse)
async def duplicate_rubric(
    request: DuplicateRubricApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateRubricApiResponse:
    """Duplicate a rubric with entire hierarchy."""
    tags = ["rubrics"]

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

        # Permission check: verify rubric exists using typed SQL
        access_params = CheckRubricDuplicateAccessSqlParams(
            profile_id=profile_id,
            rubric_id=request.rubric_id,
        )
        access_result = cast(
            CheckRubricDuplicateAccessSqlRow,
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

        if access_result.rubric_exists is False:
            raise HTTPException(
                status_code=404,
                detail=f"Rubric {request.rubric_id} not found",
            )

        can_duplicate = compute_can_duplicate(user_role=user_role)

        if not can_duplicate:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to duplicate this rubric.",
            )

        async with conn.transaction():
            params = DuplicateRubricSqlParams(
                **request.model_dump(), profile_id=profile_id
            )
            sql_params = params.to_tuple()

            result = cast(
                DuplicateRubricSqlRow,
                await execute_sql_typed(
                    conn,
                    DUPLICATE_SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.rubric_id:
                raise ValueError(f"Rubric not found: {request.rubric_id}")

            original_name = result.original_name or "Unknown"

            api_response = DuplicateRubricApiResponse.model_validate(
                {
                    "success": True,
                    "rubric_id": str(result.rubric_id),
                    "message": f"Rubric '{original_name}' duplicated successfully",
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
            operation="duplicate_rubric",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
