"""Staff update endpoint - update a staff member."""

from typing import Annotated

import asyncpg
from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

router = APIRouter()


class UpdateStaffRequest(BaseModel):
    """Request to update staff."""

    profileId: str
    role: str
    requests_per_day: int | None
    department_id: str
    active: bool


class UpdateStaffResponse(BaseModel):
    """Response from update staff."""

    success: bool
    message: str


@router.post("/update", response_model=UpdateStaffResponse)
async def update_profile(
    request: UpdateStaffRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateStaffResponse:
    """Update a profile."""
    try:
        # Check if profile exists
        name_sql = load_sql("sql/v3/profile/staff/get_profile_name.sql")
        existing = await conn.fetchrow(name_sql, request.profileId)

        if not existing:
            raise HTTPException(
                status_code=404, detail=f"Profile not found: {request.profileId}"
            )

        async with transaction(conn):
            # Update profile
            update_sql = load_sql("sql/v3/profile/staff/update_profile.sql")
            await conn.execute(update_sql, request.profileId, request.role, request.active)

            # Update department
            dept_sql = load_sql("sql/v3/profile/staff/update_profile_department.sql")
            await conn.execute(dept_sql, request.profileId, request.department_id)

            # Update or insert profile request limit if provided
            if request.requests_per_day is not None:
                limit_sql = load_sql(
                    "sql/v3/profile/staff/upsert_profile_request_limit.sql"
                )
                await conn.execute(
                    limit_sql, request.profileId, request.requests_per_day
                )

        result_data = UpdateStaffResponse(
            success=True, message=f"Staff '{existing['name']}' updated successfully"
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

