"""Staff delete endpoint - delete a staff member."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
from app.utils.sql_helper import load_sql

router = APIRouter()


class DeleteStaffRequest(BaseModel):
    """Request to delete staff."""

    profileId: str


class DeleteStaffResponse(BaseModel):
    """Response from delete staff."""

    success: bool
    message: str


@router.post("/delete")
async def delete_profile(
    request: DeleteStaffRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteStaffResponse:
    """Delete a profile."""
    try:
        # Check if profile is default
        check_sql = load_sql("sql/v3/profile/staff/check_default_profile.sql")
        result = await conn.fetchrow(check_sql, request.profileId)

        if not result:
            raise HTTPException(
                status_code=404, detail=f"Profile not found: {request.profileId}"
            )

        if result["default_profile"]:
            raise HTTPException(status_code=400, detail="Cannot delete default profile")

        # Get profile name
        name_sql = load_sql("sql/v3/profile/staff/get_profile_name.sql")
        profile = await conn.fetchrow(name_sql, request.profileId)

        if not profile:
            raise HTTPException(
                status_code=404, detail=f"Profile not found: {request.profileId}"
            )

        # Delete profile
        delete_sql = load_sql("sql/v3/profile/staff/delete_profile.sql")
        await conn.execute(delete_sql, request.profileId)

        return DeleteStaffResponse(
            success=True, message=f"Staff '{profile['name']}' deleted successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

