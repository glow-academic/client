"""Department save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (department_id = NULL) and update (department_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.department.permissions import (
    compute_can_create,
    compute_can_save,
)
from app.api.v4.artifacts.department.types import (
    SaveDepartmentApiRequest,
    SaveDepartmentApiResponse,
    SaveDepartmentSqlParams,
    SaveDepartmentSqlRow,
)
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    CheckDepartmentSaveAccessSqlParams,
    CheckDepartmentSaveAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/v4/queries/departments/check_department_save_access_complete.sql"
)
SQL_PATH = "app/sql/v4/queries/departments/save_department_complete.sql"


router = APIRouter()


@router.post(
    "/save",
    response_model=SaveDepartmentApiResponse,
    dependencies=[
        audit_activity(
            "department.saved",
            "{{ actor.name }} {% if department %}updated{% else %}created{% endif %} department{% if department %} '{{ department.title }}'{% endif %}",
        )
    ],
)
async def save_department(
    request: SaveDepartmentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveDepartmentApiResponse:
    """Save department - handles both create (department_id = NULL) and update (department_id provided)."""
    tags = ["departments"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Permission check: get user role and department info using typed SQL
        access_params = CheckDepartmentSaveAccessSqlParams(
            profile_id=profile_id,
            department_id=request.input_department_id,
        )
        access_result = cast(
            CheckDepartmentSaveAccessSqlRow,
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
        if not request.input_department_id:
            can_save_result = compute_can_create(
                user_role=access_result.user_role,
            )
        else:
            can_save_result = compute_can_save(
                user_role=access_result.user_role,
                usage_count=access_result.department_usage_count or 0,
            )

        if not can_save_result:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to save this department.",
            )

        async with conn.transaction():
            params = SaveDepartmentSqlParams.from_request(
                request,
                profile_id=profile_id,
            )
            sql_params = params.to_tuple()

            result = cast(
                SaveDepartmentSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.department_id:
                if request.input_department_id:
                    raise ValueError(
                        f"Department not found: {request.input_department_id}"
                    )
                else:
                    raise ValueError("Failed to create department")

            # Set audit context
            if result.actor_name:
                audit_ctx = {"actor": {"name": result.actor_name, "id": profile_id}}
                if request.input_department_id:
                    audit_ctx["department"] = {
                        "title": "Department",
                        "id": str(result.department_id),
                    }
                audit_set(http_request, **audit_ctx)

        # Convert SQL result to API response
        is_update = request.input_department_id is not None
        api_response = SaveDepartmentApiResponse(
            success=True,
            department_id=result.department_id,
            message="Department updated successfully"
            if is_update
            else "Department created successfully",
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        # Trigger Keycloak sync for the department
        from app.infra.v4.auth.keycloak_sync import perform_keycloak_sync

        await perform_keycloak_sync(department_id=str(result.department_id))

        return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="save_department",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
