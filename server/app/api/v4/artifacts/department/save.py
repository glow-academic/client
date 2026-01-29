"""Department save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (department_id = NULL) and update (department_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    SaveDepartmentApiRequest,
    SaveDepartmentApiResponse,
    SaveDepartmentSqlParams,
    SaveDepartmentSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
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
    tags = ["departments"]  # From router tags

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

        async with conn.transaction():
            # Convert API request to SQL params (add profile_id from header)
            # Map input_department_id from API request (already correct field name)
            params = SaveDepartmentSqlParams(
                **request.model_dump(),
                profile_id=profile_id,
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
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

            # Set audit context with data from SQL query
            if result.actor_name:
                audit_ctx = {"actor": {"name": result.actor_name, "id": profile_id}}
                # Only add department to audit context if input_department_id was provided (update mode)
                # For create mode, we don't have the name yet, so we'll use the request name if available
                if request.input_department_id:
                    # Update mode: use request name (from request body)
                    # Note: In update mode, request should have name field
                    audit_ctx["department"] = {
                        "title": getattr(request, "name", "Department"),
                        "id": str(result.department_id),
                    }
                audit_set(http_request, **audit_ctx)

        # Convert SQL result to API response
        api_response = SaveDepartmentApiResponse.model_validate(
            {
                "department_id": str(result.department_id),
                "actor_name": result.actor_name,
            }
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
