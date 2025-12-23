"""Department delete endpoint - v3 API."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db, get_internal_sio
from app.socket.v3.actions.keycloak import delete_department_realm
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import load_sql

internal_sio = get_internal_sio()


class DeleteDepartmentRequest(BaseModel):
    """Request for deleting a department."""

    departmentId: str


class DeleteDepartmentResponse(BaseModel):
    """Response for deleting a department."""

    success: bool
    message: str


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteDepartmentResponse,
    dependencies=[
        audit_activity(
            "department.deleted",
            "{{ actor.name }} deleted department '{{ department.title }}'",
        )
    ],
)
async def delete_department(
    request: DeleteDepartmentRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteDepartmentResponse:
    """Delete a department (with usage check)."""
    tags = ["departments"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Delete department with existence and usage checks in a single SQL file
        sql_query = load_sql("app/sql/v3/departments/delete_department_complete.sql")
        sql_params = (request.departmentId, profile_id)
        result = await conn.fetchrow(sql_query, request.departmentId, profile_id)

        if not result:
            # Department doesn't exist
            raise HTTPException(
                status_code=404, detail=f"Department {request.departmentId} not found"
            )

        # Check if department was deleted or is in use
        if not result["deleted"]:
            # Department exists but is in use
            total_usage = result["total_usage"]
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete department: in use by {total_usage} entities",
            )

        # Set audit context with data from SQL query
        actor_name = result.get("actor_name")
        department_title = result.get("title")
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                department={"title": department_title, "id": request.departmentId},
            )

        result = DeleteDepartmentResponse(
            success=True,
            message="Department deleted successfully",
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        # Delete Keycloak realm for the deleted department (fire-and-forget)
        await delete_department_realm(request.departmentId)

        return result
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
