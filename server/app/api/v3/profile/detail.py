"""Profile detail endpoint - get profile by ID."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
from app.utils.sql_helper import load_sql

router = APIRouter()


class ProfileDetailRequest(BaseModel):
    """Request to get profile details."""

    profileId: str


class ProfileItem(BaseModel):
    """Profile data item."""

    id: str
    firstName: str
    lastName: str
    alias: str
    role: str  # 'superadmin' | 'admin' | 'instructional' | 'ta' | 'guest'
    active: bool
    viewedIntro: bool
    viewedChat: bool
    defaultProfile: bool
    reqPerDay: int | None
    lastLogin: str  # ISO datetime
    lastActive: str | None  # ISO datetime
    createdAt: str  # ISO datetime
    updatedAt: str  # ISO datetime
    primaryDepartmentId: str | None  # UUID of primary department


class ProfileDetailResponse(BaseModel):
    """Response containing profile details."""

    profile: ProfileItem


@router.post("/detail")
async def get_profile_detail(
    request: ProfileDetailRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ProfileDetailResponse:
    """Get profile by ID (simple auth version without permissions)."""
    try:
        # Resolve "guest-profile-id" to actual default guest profile
        profile_id = request.profileId
        if profile_id == "guest-profile-id":
            guest_sql = load_sql("sql/v3/profile/get_default_guest_profile.sql")
            guest_row = await conn.fetchrow(guest_sql)
            if guest_row:
                profile_id = str(guest_row["id"])
            else:
                raise HTTPException(
                    status_code=404, detail="No default guest profile found in database"
                )

        # Load SQL string
        sql = load_sql("sql/v3/profile/get_profile.sql")

        # Execute with full control over transaction
        row = await conn.fetchrow(sql, profile_id)
        if not row:
            raise HTTPException(status_code=404, detail="Profile not found")

        # Transform database row to response (inline business logic)
        profile = ProfileItem(
            id=str(row["id"]),
            firstName=row["first_name"],
            lastName=row["last_name"],
            alias=row["alias"],
            role=row["role"],
            active=row["active"],
            viewedIntro=row["viewed_intro"],
            viewedChat=row["viewed_chat"],
            defaultProfile=row["default_profile"],
            reqPerDay=row["req_per_day"],
            lastLogin=row["last_login"].isoformat() if row["last_login"] else "",
            lastActive=row["last_active"].isoformat() if row["last_active"] else None,
            createdAt=row["created_at"].isoformat() if row["created_at"] else "",
            updatedAt=row["updated_at"].isoformat() if row["updated_at"] else "",
            primaryDepartmentId=str(row["primary_department_id"])
            if row.get("primary_department_id")
            else None,
        )

        return ProfileDetailResponse(profile=profile)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

