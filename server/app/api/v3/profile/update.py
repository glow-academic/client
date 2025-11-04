"""Profile update endpoint - update profile fields."""

from datetime import UTC, datetime
from typing import Annotated, Any

import asyncpg
from app.api.v3.profile.detail import ProfileDetailResponse, ProfileItem
from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
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
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ProfileDetailResponse:
    """Update profile fields (simple auth version)."""
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

    # Extract updates from request, excluding profileId and None values
    updates = request.model_dump(exclude={"profileId"}, exclude_none=True)

    if not updates:
        # No updates, just return the current profile
        detail_sql = load_sql("sql/v3/profile/get_profile.sql")
        row = await conn.fetchrow(detail_sql, profile_id)
        if not row:
            raise HTTPException(status_code=404, detail="Profile not found")
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

    # Map camelCase API field names to snake_case database column names
    field_map = {
        "firstName": "first_name",
        "lastName": "last_name",
        "lastLogin": "last_login",
        "viewedIntro": "viewed_intro",
        "viewedChat": "viewed_chat",
        "defaultProfile": "default_profile",
        "role": "role",
        "active": "active",
    }

    # Process lastLogin ISO string to datetime if present
    processed_updates = updates.copy()
    if "lastLogin" in processed_updates and isinstance(processed_updates["lastLogin"], str):
        try:
            dt = datetime.fromisoformat(processed_updates["lastLogin"].replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=UTC)
            processed_updates["lastLogin"] = dt
        except (ValueError, AttributeError):
            pass

    # Build SET clause dynamically from updates (excluding lastActive)
    set_clauses = []
    params: list[Any] = []
    param_counter = 1
    last_active_value = None

    for key, value in processed_updates.items():
        if key == "lastActive":
            # Store for profile_activity insert
            if isinstance(value, str):
                try:
                    last_active_value = datetime.fromisoformat(value.replace("Z", "+00:00"))
                    if last_active_value.tzinfo is None:
                        last_active_value = last_active_value.replace(tzinfo=UTC)
                except (ValueError, AttributeError):
                    pass
            else:
                last_active_value = value
            continue
        # Convert camelCase to snake_case using the map
        db_field = field_map.get(key, key)
        set_clauses.append(f"{db_field} = ${param_counter}")
        params.append(value)
        param_counter += 1

    # Always update updated_at
    set_clauses.append("updated_at = NOW()")

    # Add profile_id as parameter for UPDATE WHERE clause
    profile_id_param = param_counter
    update_params = params + [profile_id]

    # Build UPDATE query dynamically
    update_query = f"""
    UPDATE profiles SET
        {", ".join(set_clauses)}
    WHERE id = ${profile_id_param}
    """

    # Execute queries in a transaction
    async with transaction(conn):
        # Execute UPDATE
        await conn.execute(update_query, *update_params)

        # Execute INSERT for lastActive if provided
        if last_active_value is not None:
            insert_sql = load_sql("sql/v3/profile/update_profile_insert_activity.sql")
            await conn.execute(insert_sql, profile_id, last_active_value)

        # Execute SELECT to get updated profile
        select_sql = load_sql("sql/v3/profile/update_profile_select.sql")
        row = await conn.fetchrow(select_sql, profile_id)

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
    tags = ["profile"]  # From router tags
    await invalidate_tags(tags)
    response.headers["X-Invalidate-Tags"] = ",".join(tags)
    
    return result_data

