"""Profile update endpoint - update profile fields."""

from datetime import UTC, datetime
from typing import Annotated, Any

import asyncpg
from app.api.v3.profile.detail import ProfileDetailResponse, ProfileItem
from app.db import get_db
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter()


class UpdateProfileRequest(BaseModel):
    """Request to update profile fields."""

    profileId: str
    firstName: str | None = None
    lastName: str | None = None
    lastLogin: str | None = None  # ISO datetime
    role: str | None = None
    active: bool | None = None
    viewedIntro: bool | None = None
    viewedChat: bool | None = None
    reqPerDay: int | None = None
    lastActive: str | None = None  # ISO datetime


@router.post("/update", response_model=ProfileDetailResponse)
async def update_profile(
    request: UpdateProfileRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ProfileDetailResponse:
    """Update profile fields (simple auth version)."""
    tags = ["profile"]  # From router tags
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        # Process lastLogin ISO string to datetime if present
        last_login_dt = None
        if request.lastLogin:
            try:
                last_login_dt = datetime.fromisoformat(request.lastLogin.replace("Z", "+00:00"))
                if last_login_dt.tzinfo is None:
                    last_login_dt = last_login_dt.replace(tzinfo=UTC)
            except (ValueError, AttributeError):
                pass

        # Process lastActive ISO string to datetime if present
        last_active_dt = None
        if request.lastActive:
            try:
                last_active_dt = datetime.fromisoformat(request.lastActive.replace("Z", "+00:00"))
                if last_active_dt.tzinfo is None:
                    last_active_dt = last_active_dt.replace(tzinfo=UTC)
            except (ValueError, AttributeError):
                pass

        # Update profile with all fields in a single SQL file
        # Pass None for fields that aren't being updated (SQL uses COALESCE to keep existing values)
        # Note: req_per_day is stored in profile_request_limits table, not updated here
        sql_query = load_sql("sql/v3/profile/update_profile_complete.sql")
        sql_params = (
            request.profileId,  # $1
            request.firstName,  # $2
            request.lastName,  # $3
            last_login_dt,  # $4
            request.role,  # $5
            request.active,  # $6
            request.viewedIntro,  # $7
            request.viewedChat,  # $8
            None,  # $9 - req_per_day (not used, stored in separate table)
            last_active_dt,  # $10
        )
        row = await conn.fetchrow(
            sql_query,
            request.profileId,  # $1
            request.firstName,  # $2
            request.lastName,  # $3
            last_login_dt,  # $4
            request.role,  # $5
            request.active,  # $6
            request.viewedIntro,  # $7
            request.viewedChat,  # $8
            None,  # $9 - req_per_day (not used, stored in separate table)
            last_active_dt,  # $10
        )

        if not row:
            raise HTTPException(status_code=404, detail="Profile not found")

        # Transform database row to response
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

        result_data = ProfileDetailResponse(profile=profile)
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_profile",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

