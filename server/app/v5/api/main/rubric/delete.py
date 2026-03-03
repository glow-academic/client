"""Rubric delete endpoint - v4 API."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.rubric.permissions import compute_can_delete
from app.v5.api.main.rubric.types import (
    DeleteRubricApiRequest,
    DeleteRubricApiResponse,
)
from app.auth.profile import get_auth_profile_internal
from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db, get_pool
from app.sql.types import (
    CheckRubricDeleteAccessSqlParams,
    CheckRubricDeleteAccessSqlRow,
    DeleteRubricSqlParams,
    DeleteRubricSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/queries/rubrics/check_rubric_delete_access_complete.sql"
)
DELETE_SQL_PATH = "app/sql/queries/rubric/delete_rubric_complete.sql"

router = APIRouter()


@router.post("/delete", response_model=DeleteRubricApiResponse)
async def delete_rubric(
    request: DeleteRubricApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteRubricApiResponse:
    """Delete a rubric."""
    tags = ["rubrics"]

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

        # Permission check: get user role and rubric info using typed SQL
        access_params = CheckRubricDeleteAccessSqlParams(
            profile_id=profile_id,
            rubric_id=request.rubric_id,
        )
        access_result = cast(
            CheckRubricDeleteAccessSqlRow,
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
            rubric_department_ids=access_result.rubric_department_ids,
            active_simulation_count=access_result.active_simulation_count or 0,
        )

        if not can_delete:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to delete this rubric.",
            )

        async with conn.transaction():
            params = DeleteRubricSqlParams(
                **request.model_dump(), profile_id=profile_id
            )
            sql_params = params.to_tuple()

            result = cast(
                DeleteRubricSqlRow,
                await execute_sql_typed(
                    conn,
                    DELETE_SQL_PATH,
                    params=params,
                ),
            )

            if not result:
                raise ValueError("Failed to check rubric usage")

            if not result.rubric_id:
                raise HTTPException(
                    status_code=404, detail=f"Rubric {request.rubric_id} not found"
                )

            if not result.deleted:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot delete rubric: in use by {result.usage_count} simulation(s)",
                )

            rubric_name = result.name or "Unknown"

        api_response = DeleteRubricApiResponse.model_validate(
            {
                "success": True,
                "message": f"Rubric '{rubric_name}' deleted successfully",
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
            operation="delete_rubric",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
