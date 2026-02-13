"""Eval save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (eval_id = NULL) and update (eval_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.eval.permissions import (
    compute_can_create,
    compute_can_save,
)
from app.api.v4.artifacts.eval.types import (
    SaveEvalApiRequest,
    SaveEvalApiResponse,
    SaveEvalSqlParams,
    SaveEvalSqlRow,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    CheckEvalSaveAccessSqlParams,
    CheckEvalSaveAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = "app/sql/v4/queries/evals/check_eval_save_access_complete.sql"
SQL_PATH = "app/sql/v4/queries/evals/save_eval_complete.sql"


router = APIRouter()


@router.post(
    "/save",
    response_model=SaveEvalApiResponse,
    dependencies=[
        audit_activity(
            "eval.saved",
            "{{ actor.name }} {% if eval %}updated{% else %}created{% endif %} eval{% if eval %} '{{ eval.name }}'{% endif %}",
        )
    ],
)
async def save_eval(
    request: SaveEvalApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveEvalApiResponse:
    """Save eval - handles both create (eval_id = NULL) and update (eval_id provided)."""
    tags = ["evals"]  # From router tags

    sql_query = load_sql_query(SQL_PATH)
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

        # Permission check: get user role and eval info using typed SQL
        access_params = CheckEvalSaveAccessSqlParams(
            profile_id=profile_id,
            eval_id=request.input_eval_id,
        )
        access_result = cast(
            CheckEvalSaveAccessSqlRow,
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
        if not request.input_eval_id:
            can_save_result = compute_can_create(
                user_role=user_role,
                department_ids=request.departments.resource_ids,
            )
        else:
            can_save_result = compute_can_save(
                user_role=user_role,
                user_department_ids=user_department_ids,
                eval_department_ids=access_result.eval_department_ids,
                active_usage_count=access_result.active_usage_count or 0,
            )

        if not can_save_result:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to save this eval.",
            )

        async with conn.transaction():
            # Convert API request to SQL params (add profile_id from header)
            params = SaveEvalSqlParams.from_request(
                request=request,
                profile_id=profile_id,
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper
            result = cast(
                SaveEvalSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.eval_id:
                if request.input_eval_id:
                    raise ValueError(f"Eval not found: {request.input_eval_id}")
                else:
                    raise ValueError("Failed to create eval")

            # Set audit context with data from SQL query
            if actor_name:
                audit_ctx = {"actor": {"name": actor_name, "id": profile_id}}
                if request.input_eval_id:
                    audit_ctx["eval"] = {
                        "name": "Eval",
                        "id": str(result.eval_id),
                    }
                audit_set(http_request, **audit_ctx)

        # Convert SQL result to API response
        is_update = request.input_eval_id is not None
        api_response = SaveEvalApiResponse.model_validate(
            {
                "success": True,
                "eval_id": str(result.eval_id),
                "message": "Eval updated successfully"
                if is_update
                else "Eval created successfully",
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
            operation="save_eval",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
