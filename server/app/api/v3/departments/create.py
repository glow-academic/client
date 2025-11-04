"""Department create endpoint - v3 API."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
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
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateDepartmentResponse:
    """Create a new department."""
    tags = ["departments"]  # From router tags
    
    try:
        async with transaction(conn):
            sql = load_sql("sql/v3/departments/create_department.sql")
            dept_row = await conn.fetchrow(sql, request.title, request.description, request.active)

            if not dept_row:
                raise HTTPException(status_code=500, detail="Failed to create department")

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
        raise HTTPException(status_code=500, detail=str(e))

