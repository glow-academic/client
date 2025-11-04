"""Staff create endpoint - create a new staff member."""

import uuid
from typing import Annotated

import asyncpg
from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

router = APIRouter()


class CreateStaffRequest(BaseModel):
    """Request to create a single staff member."""

    firstName: str
    lastName: str
    alias: str
    role: str
    department_id: str | None = None


class CreateStaffResponse(BaseModel):
    """Response from create staff."""

    success: bool
    profileId: str
    message: str


@router.post("/create", response_model=CreateStaffResponse)
async def create_profile(
    request: CreateStaffRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateStaffResponse:
    """Create a new profile."""
    try:
        # Check if alias already exists
        check_sql = load_sql("sql/v3/profile/staff/check_alias_exists.sql")
        existing = await conn.fetchrow(check_sql, request.alias)

        if existing:
            raise HTTPException(
                status_code=400, detail=f"Alias '{request.alias}' already exists"
            )

        # Generate new profile ID
        profile_id = str(uuid.uuid4())

        async with transaction(conn):
            # Insert profile
            create_sql = load_sql("sql/v3/profile/staff/create_profile.sql")
            await conn.execute(
                create_sql,
                profile_id,
                request.firstName,
                request.lastName,
                request.alias,
                request.role,
                True,  # active
                False,  # default_profile
                False,  # viewed_intro
                False,  # viewed_chat
            )

            # If department_id is provided, insert profile_departments relationship
            if request.department_id:
                dept_sql = load_sql("sql/v3/profile/staff/insert_profile_department.sql")
                await conn.execute(dept_sql, profile_id, request.department_id)

        result_data = CreateStaffResponse(
            success=True,
            profileId=profile_id,
            message=f"Staff '{request.firstName} {request.lastName}' created successfully",
        )
        
        # Invalidate cache after mutation
        tags = ["staff", "profile"]  # Staff operations also affect profile cache
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

