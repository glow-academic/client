"""Department create endpoint - v3 API."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db, transaction
from app.utils.error.handle_route_error import handle_route_error
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


class CreateDepartmentRequest(BaseModel):
    """Request for creating a department."""

    title: str
    description: str
    active: bool
    profile_id: str


class CreateDepartmentResponse(BaseModel):
    """Response for creating a department."""

    success: bool
    departmentId: str
    message: str


router = APIRouter()


@router.post("/create", response_model=CreateDepartmentResponse)
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
            sql_query = load_sql("sql/v3/departments/create_department.sql")
            sql_params = (request.title, request.description, request.active)
            dept_row = await conn.fetchrow(
                sql_query, request.title, request.description, request.active
            )

            if not dept_row:
                raise HTTPException(
                    status_code=500, detail="Failed to create department"
                )

            department_id = dept_row["department_id"]

            # Automatically link all superadmins, default profiles, and the creator
            auto_link_query = """
            SELECT id FROM profiles 
            WHERE role = 'superadmin' OR default_profile = true OR id = $1
            """
            profiles_to_link = await conn.fetch(auto_link_query, request.profile_id)

            for profile in profiles_to_link:
                profile_dept_query = """
                INSERT INTO profile_departments (profile_id, department_id)
                VALUES ($1, $2)
                ON CONFLICT (profile_id, department_id) DO NOTHING
                """
                await conn.execute(profile_dept_query, profile["id"], department_id)

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
