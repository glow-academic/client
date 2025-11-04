"""Staff bulk create endpoint - bulk create staff members."""

import uuid
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.v3.profile.staff.create import CreateStaffRequest
from app.db import get_db, transaction
from app.utils.sql_helper import load_sql

router = APIRouter()


class BulkCreateStaffRequest(BaseModel):
    """Request to bulk create staff members."""

    profiles: list[CreateStaffRequest]


class BulkCreateStaffResponse(BaseModel):
    """Response from bulk create staff."""

    success: bool
    profileIds: list[str]
    message: str


@router.post("/bulk-create")
async def bulk_create_profile(
    request: BulkCreateStaffRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkCreateStaffResponse:
    """Bulk create profiles."""
    try:
        # Check for duplicate aliases
        aliases = [p.alias for p in request.profiles]
        check_sql = load_sql("sql/v3/profile/staff/check_aliases_exist.sql")
        existing = await conn.fetch(check_sql, aliases)

        if existing:
            existing_aliases = [row["alias"] for row in existing]
            raise HTTPException(
                status_code=400,
                detail=f"Aliases already exist: {', '.join(existing_aliases)}",
            )

        # Create all profiles
        profile_ids: list[str] = []
        create_sql = load_sql("sql/v3/profile/staff/create_profile.sql")
        dept_sql = load_sql("sql/v3/profile/staff/insert_profile_department.sql")

        async with transaction(conn):
            for profile_req in request.profiles:
                profile_id = str(uuid.uuid4())
                profile_ids.append(profile_id)

                # Insert profile
                await conn.execute(
                    create_sql,
                    profile_id,
                    profile_req.firstName,
                    profile_req.lastName,
                    profile_req.alias,
                    profile_req.role,
                    True,  # active
                    False,  # default_profile
                    False,  # viewed_intro
                    False,  # viewed_chat
                )

                # If department_id is provided, insert profile_departments relationship
                if profile_req.department_id:
                    await conn.execute(dept_sql, profile_id, profile_req.department_id)

        return BulkCreateStaffResponse(
            success=True,
            profileIds=profile_ids,
            message=f"{len(profile_ids)} staff members created successfully",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

