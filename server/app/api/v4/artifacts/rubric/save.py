"""Rubric save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (rubric_id = NULL) and update (rubric_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.rubric.permissions import (
    compute_can_create,
    compute_can_save,
)
from app.api.v4.artifacts.rubric.types import (
    SaveRubricApiRequest,
    SaveRubricApiResponse,
    SaveRubricSqlParams,
    SaveRubricSqlRow,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    CheckRubricSaveAccessSqlParams,
    CheckRubricSaveAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/v4/queries/rubrics/check_rubric_save_access_complete.sql"
)
SQL_PATH = "app/sql/v4/queries/rubrics/save_rubric_complete.sql"


router = APIRouter()


@router.post(
    "/save",
    response_model=SaveRubricApiResponse,
    dependencies=[
        audit_activity(
            "rubric.saved",
            "{{ actor.name }} {% if rubric %}updated{% else %}created{% endif %} rubric{% if rubric %} '{{ rubric.name }}'{% endif %}",
        )
    ],
)
async def save_rubric(
    request: SaveRubricApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveRubricApiResponse:
    """Save rubric - handles both create (rubric_id = NULL) and update (rubric_id provided)."""
    tags = ["rubrics"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
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

        # Permission check: get user role and rubric info using typed SQL
        access_params = CheckRubricSaveAccessSqlParams(
            profile_id=profile_id,
            rubric_id=request.input_rubric_id,
        )
        access_result = cast(
            CheckRubricSaveAccessSqlRow,
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
        if not request.input_rubric_id:
            can_save_result = compute_can_create(
                user_role=user_role,
                department_ids=None,
            )
        else:
            can_save_result = compute_can_save(
                user_role=user_role,
                rubric_department_ids=access_result.rubric_department_ids,
                active_simulation_count=access_result.active_simulation_count or 0,
            )

        if not can_save_result:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to save this rubric.",
            )

        async with conn.transaction():
            params = SaveRubricSqlParams.from_request(request, profile_id)
            sql_params = params.to_tuple()

            result = cast(
                SaveRubricSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.rubric_id:
                if request.input_rubric_id:
                    raise ValueError(f"Rubric not found: {request.input_rubric_id}")
                else:
                    raise ValueError("Failed to create rubric")

            # Set audit context
            if actor_name:
                audit_ctx = {"actor": {"name": actor_name, "id": profile_id}}
                if request.input_rubric_id:
                    audit_ctx["rubric"] = {
                        "name": getattr(request, "name", "Rubric"),
                        "id": str(result.rubric_id),
                    }
                audit_set(http_request, **audit_ctx)

        is_update = request.input_rubric_id is not None
        api_response = SaveRubricApiResponse.model_validate(
            {
                "success": True,
                "rubric_id": str(result.rubric_id),
                "message": "Rubric updated successfully"
                if is_update
                else "Rubric created successfully",
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
            operation="save_rubric",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
