"""Department create endpoint - v3 API."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.activity.audit import audit_activity, audit_set
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


class CreateDepartmentRequest(BaseModel):
    """Request for creating a department."""

    title: str
    description: str
    active: bool
    settingsId: str | None = None
    profileId: str  # Required for auditing/access control


class CreateDepartmentResponse(BaseModel):
    """Response for creating a department."""

    success: bool
    departmentId: str
    message: str


router = APIRouter()


@router.post(
    "/create",
    response_model=CreateDepartmentResponse,
    dependencies=[
        audit_activity(
            "department.created",
            "{{ actor.name }} created department '{{ department.title }}'",
        )
    ],
)
async def create_department(
    request: CreateDepartmentRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateDepartmentResponse:
    """Create a new department."""
    tags = ["departments"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Require profileId in request body (already required by Pydantic model)
            profile_id = request.profileId

            # Single consolidated query: creates department and settings relationship
            sql_query = load_sql("sql/v3/departments/create_department_complete.sql")
            sql_params = (
                request.title,
                request.description,
                request.active,
                request.settingsId,
                profile_id,
            )
            dept_row = await conn.fetchrow(sql_query, *sql_params)

            if not dept_row:
                raise HTTPException(
                    status_code=500, detail="Failed to create department"
                )

            department_id = dept_row["department_id"]
            actor_name = dept_row.get("actor_name")

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    department={"title": request.title, "id": department_id},
                )

        result = CreateDepartmentResponse(
            success=True,
            departmentId=department_id,
            message="Department created successfully",
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_department",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
