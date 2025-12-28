"""Department delete endpoint - v3 API."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db, get_internal_sio
from app.infra.v3.auth.keycloak_sync import delete_department_realm
from app.sql.types import (
    DeleteDepartmentApiRequest,
    DeleteDepartmentApiResponse,
    DeleteDepartmentSqlParams,
    DeleteDepartmentSqlRow,
    load_sql_query,
)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/departments/delete_department_complete.sql"

router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteDepartmentApiResponse,
    dependencies=[
        audit_activity(
            "department.deleted",
            "{{ actor.name }} deleted department '{{ department.title }}'",
        )
    ],
)
async def delete_department(
    request: DeleteDepartmentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteDepartmentApiResponse:
    """Delete a department (with usage check)."""
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

        # Convert API request to SQL params (add profile_id from header)
        params = DeleteDepartmentSqlParams(**request.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        # Execute SQL with typed helper
        result = cast(
            DeleteDepartmentSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Check if department exists using SQL result
        if not result.department_exists:
            raise HTTPException(
                status_code=404, detail=f"Department {request.department_id} not found"
            )

        # Check if department was deleted or is in use
        if not result.deleted:
            # Department exists but is in use
            total_usage = result.total_usage
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete department: in use by {total_usage} entities",
            )

        # Set audit context with data from SQL query
        actor_name = result.actor_name
        department_title = result.title
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                department={"title": department_title or "Unknown", "id": str(request.department_id)},
            )

        result_response = DeleteDepartmentApiResponse.model_validate(result.model_dump())

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        # Delete Keycloak realm for the deleted department (fire-and-forget)
        await delete_department_realm(str(request.department_id))

        return result_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_department",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
