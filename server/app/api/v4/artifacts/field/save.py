"""Field save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (field_id = NULL) and update (field_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.field.permissions import (
    compute_can_create,
    compute_can_save,
)
from app.api.v4.artifacts.field.types import (
    SaveFieldApiRequest,
    SaveFieldApiResponse,
    SaveFieldSqlParams,
    SaveFieldSqlRow,
)
from app.api.v4.auth.context import get_profile_context_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    CheckFieldSaveAccessSqlParams,
    CheckFieldSaveAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = "app/sql/v4/queries/fields/check_field_save_access_complete.sql"
SQL_PATH = "app/sql/v4/queries/fields/save_field_complete.sql"


router = APIRouter()


@router.post(
    "/save",
    response_model=SaveFieldApiResponse,
    dependencies=[
        audit_activity(
            "field.saved",
            "{{ actor.name }} {% if field %}updated{% else %}created{% endif %} field{% if field %} '{{ field.name }}'{% endif %}",
        )
    ],
)
async def save_field(
    request: SaveFieldApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveFieldApiResponse:
    """Save field - handles both create (field_id = NULL) and update (field_id provided)."""
    tags = ["fields"]

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
                resolved_context = await get_profile_context_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    department_id_cookie=None,
                    bypass_cache=False,
                )
                actor_name = resolved_context.actor_name
                user_role = resolved_context.user_role
                user_department_ids = [
                    d.department_id for d in resolved_context.departments if d.department_id
                ]
        else:
            actor_name = None
            user_role = None
            user_department_ids = []

        # Permission check: get user role and field info using typed SQL
        access_params = CheckFieldSaveAccessSqlParams(
            profile_id=profile_id,
            field_id=request.input_field_id,
        )
        access_result = cast(
            CheckFieldSaveAccessSqlRow,
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
        if not request.input_field_id:
            can_save_result = compute_can_create(
                user_role=user_role,
                department_ids=request.departments.resource_ids,
            )
        else:
            can_save_result = compute_can_save(
                user_role=user_role,
                user_department_ids=user_department_ids,
                field_department_ids=access_result.field_department_ids,
            )

        if not can_save_result:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to save this field.",
            )

        async with conn.transaction():
            params = SaveFieldSqlParams.from_request(
                request,
                profile_id=profile_id,
            )
            sql_params = params.to_tuple()

            result = cast(
                SaveFieldSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.field_id:
                if request.input_field_id:
                    raise ValueError(f"Field not found: {request.input_field_id}")
                else:
                    raise ValueError("Failed to create field")

            if actor_name:
                audit_ctx = {"actor": {"name": actor_name, "id": profile_id}}
                if request.input_field_id:
                    audit_ctx["field"] = {
                        "name": getattr(request, "name", "Field"),
                        "id": str(result.field_id),
                    }
                audit_set(http_request, **audit_ctx)

        is_update = request.input_field_id is not None
        api_response = SaveFieldApiResponse.model_validate(
            {
                "success": True,
                "field_id": str(result.field_id),
                "message": "Field updated successfully"
                if is_update
                else "Field created successfully",
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
            operation="save_field",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
