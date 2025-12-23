"""Department update endpoint - v3 API."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db, get_internal_sio, transaction
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import load_sql

internal_sio = get_internal_sio()


class UpdateDepartmentRequest(BaseModel):
    """Request for updating a department."""

    departmentId: str
    title: str
    description: str
    active: bool
    settingsId: str | None = None


class UpdateDepartmentResponse(BaseModel):
    """Response for updating a department."""

    success: bool
    message: str


router = APIRouter()


@router.post(
    "/update",
    response_model=UpdateDepartmentResponse,
    dependencies=[
        audit_activity(
            "department.updated",
            "{{ actor.name }} updated department '{{ department.title }}'",
        )
    ],
)
async def update_department(
    request: UpdateDepartmentRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateDepartmentResponse:
    """Update a department."""
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

        async with transaction(conn):
            # Single consolidated query: updates department and settings relationship
            sql_query = load_sql("app/sql/v3/departments/update_department_complete.sql")
            sql_params = (
                request.departmentId,
                request.title,
                request.description,
                request.active,
                request.settingsId,
                profile_id,  # For actor_name
            )
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise HTTPException(status_code=404, detail="Department not found")

            # Set audit context with data from SQL query
            actor_name = result.get("actor_name")
            department_title = result.get("title") or request.title
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    department={"title": department_title, "id": request.departmentId},
                )

        result = UpdateDepartmentResponse(
            success=True,
            message="Department updated successfully",
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        # Trigger Keycloak sync for the updated department
        await internal_sio.emit(
            "keycloak_sync", {"department_id": request.departmentId}
        )

        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_department",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
