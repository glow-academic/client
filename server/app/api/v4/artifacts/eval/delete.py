"""Eval delete endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.eval.permissions import compute_can_delete
from app.api.v4.artifacts.eval.types import (
    DeleteEvalApiRequest,
    DeleteEvalApiResponse,
)
from app.api.v4.auth.context import get_profile_context_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    CheckEvalDeleteAccessSqlParams,
    CheckEvalDeleteAccessSqlRow,
    DeleteEvalSqlParams,
    DeleteEvalSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = "app/sql/v4/queries/evals/check_eval_delete_access_complete.sql"
DELETE_SQL_PATH = "app/sql/v4/queries/evals/delete_eval_complete.sql"


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteEvalApiResponse,
    dependencies=[
        audit_activity(
            "eval.deleted", "{{ actor.name }} deleted eval '{{ eval.name }}'"
        )
    ],
)
async def delete_eval(
    request: DeleteEvalApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteEvalApiResponse:
    """Delete an eval."""
    tags = ["evals"]  # From router tags

    sql_query = load_sql_query(DELETE_SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Fetch user context for permissions and audit logging
        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                resolved_context = await get_profile_context_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    department_id_cookie=None,
                    bypass_cache=False,
                )
                actor_name = resolved_context.actor_name
                user_role = resolved_context.user_role
        else:
            actor_name = None
            user_role = None

        # Permission check: get user role and eval info using typed SQL
        access_params = CheckEvalDeleteAccessSqlParams(
            profile_id=profile_id,
            eval_id=request.eval_id,
        )
        access_result = cast(
            CheckEvalDeleteAccessSqlRow,
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
            eval_department_ids=access_result.eval_department_ids,
            total_usage_links=access_result.total_usage_links or 0,
        )

        if not can_delete:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to delete this eval.",
            )

        async with conn.transaction():
            # Convert API request to SQL params (add profile_id from header)
            params = DeleteEvalSqlParams(**request.model_dump(), profile_id=profile_id)
            sql_params = params.to_tuple()

            # Execute SQL with typed helper
            result = cast(
                DeleteEvalSqlRow,
                await execute_sql_typed(
                    conn,
                    DELETE_SQL_PATH,
                    params=params,
                ),
            )

            if not result:
                raise ValueError("Failed to check eval usage")

            usage_count = result.usage_count or 0
            if usage_count > 0:
                raise ValueError("Cannot delete eval that is in use")

            if not result.deleted:
                raise ValueError(f"Eval not found: {request.eval_id}")

            eval_name = result.eval_name or "Unknown"

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    eval={"name": eval_name, "id": str(request.eval_id)},
                )

        # Convert SQL result to API response
        api_response = DeleteEvalApiResponse.model_validate(
            {
                "success": True,
                "message": f"Eval '{eval_name}' deleted successfully",
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
            operation="delete_eval",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
