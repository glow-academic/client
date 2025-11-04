"""Staff create endpoint - create a new staff member."""

import uuid
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db, transaction
from app.utils.sql_helper import load_sql

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


@router.post("/create")
async def create_profile(
    request: CreateStaffRequest,
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

        return CreateStaffResponse(
            success=True,
            profileId=profile_id,
            message=f"Staff '{request.firstName} {request.lastName}' created successfully",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

