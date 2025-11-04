"""Staff bulk update endpoint - bulk update staff members."""

from typing import Annotated, Any

import asyncpg
from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

router = APIRouter()


class BulkUpdateStaffRequest(BaseModel):
    """Request to bulk update staff."""

    profileIds: list[str]
    role: str | None = None
    requests_per_day: int | None | str = None  # int for limit, None for unlimited, "__keep__" to not update
    default_profile: bool | None = None
    currentProfileId: str  # Current user's profile ID for permission validation
    active: bool | None = None


class BulkUpdateStaffResponse(BaseModel):
    """Response from bulk update staff."""

    success: bool
    message: str


@router.post("/bulk-update", response_model=BulkUpdateStaffResponse)
async def bulk_update_profile(
    request: BulkUpdateStaffRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkUpdateStaffResponse:
    """Bulk update profiles."""
    try:
        # Get current user's role for validation
        role_sql = load_sql("sql/v3/profile/staff/get_profile_role.sql")
        current_user = await conn.fetchrow(role_sql, request.currentProfileId)
        
        if not current_user:
            raise HTTPException(
                status_code=404,
                detail=f"Current user profile not found: {request.currentProfileId}",
            )
        
        current_user_role = current_user["role"]

        # Role hierarchy validation helper
        def can_assign_role(creator_role: str, target_role: str) -> bool:
            """Check if creator_role can assign target_role."""
            role_hierarchy = {
                "superadmin": ["superadmin", "admin", "instructional", "ta", "guest"],
                "admin": ["instructional", "ta", "guest"],
                "instructional": ["ta", "guest"],
                "ta": ["guest"],
                "guest": [],
            }
            return target_role in role_hierarchy.get(creator_role, [])
        
        def get_assignable_roles(creator_role: str) -> list[str]:
            """Get list of roles that creator_role can assign."""
            role_hierarchy = {
                "superadmin": ["superadmin", "admin", "instructional", "ta", "guest"],
                "admin": ["instructional", "ta", "guest"],
                "instructional": ["ta", "guest"],
                "ta": ["guest"],
                "guest": [],
            }
            return role_hierarchy.get(creator_role, [])

        async with transaction(conn):
            # Validate permissions for each profile before updating
            check_default_sql = load_sql("sql/v3/profile/staff/check_default_profile.sql")
            for profile_id in request.profileIds:
                # Check if profile is default_profile
                profile_data = await conn.fetchrow(check_default_sql, profile_id)
                
                if not profile_data:
                    raise HTTPException(
                        status_code=404, detail=f"Profile not found: {profile_id}"
                    )
                
                target_is_default = profile_data["default_profile"]
                # Get target role for validation
                target_role_row = await conn.fetchrow(role_sql, profile_id)
                target_role = target_role_row["role"] if target_role_row else None
                
                # Validate default_profile editing (only superadmin can edit default profiles)
                if target_is_default and current_user_role != "superadmin":
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot edit default profile {profile_id}. Only superadmin can edit default profiles.",
                    )
                
                # Validate role assignment if role is being updated
                if request.role is not None:
                    if not can_assign_role(current_user_role, request.role):
                        assignable = get_assignable_roles(current_user_role)
                        raise HTTPException(
                            status_code=403,
                            detail=f"Cannot assign role '{request.role}' with current role '{current_user_role}'. "
                            f"Only roles: {', '.join(assignable)} can be assigned.",
                        )
                    
                    # Cannot assign role equal or higher than current role (except self and superadmin)
                    if profile_id != request.currentProfileId and current_user_role != "superadmin":
                        role_levels = {
                            "superadmin": 4,
                            "admin": 3,
                            "instructional": 2,
                            "ta": 1,
                            "guest": 0,
                        }
                        current_level = role_levels.get(current_user_role, -1)
                        target_level = role_levels.get(request.role, -1)
                        if target_level >= current_level:
                            raise HTTPException(
                                status_code=403,
                                detail=f"Cannot assign role '{request.role}' which is equal or higher than current role '{current_user_role}'.",
                            )

            # Build dynamic SET clauses for profiles table (excluding requests_per_day)
            set_clauses = []
            params: list[Any] = [request.profileIds]
            param_idx = 2

            if request.role is not None:
                set_clauses.append(f"role = ${param_idx}")
                params.append(request.role)
                param_idx += 1

            if request.default_profile is not None:
                set_clauses.append(f"default_profile = ${param_idx}")
                params.append(request.default_profile)
                param_idx += 1

            if request.active is not None:
                set_clauses.append(f"active = ${param_idx}")
                params.append(request.active)
                param_idx += 1

            # Update profiles if there are fields to update
            if set_clauses:
                update_sql = f"""
                UPDATE profiles SET
                    {", ".join(set_clauses)},
                    updated_at = NOW()
                WHERE id = ANY($1)
                """
                await conn.execute(update_sql, *params)

            # Update request limits if provided
            # requests_per_day can be:
            # - int: specific limit
            # - None: unlimited
            # - "__keep__": don't update (keep existing)
            if isinstance(request.requests_per_day, str) and request.requests_per_day == "__keep__":
                # Don't update requests_per_day
                pass
            else:
                limit_sql = load_sql("sql/v3/profile/staff/upsert_profile_request_limit.sql")
                for profile_id in request.profileIds:
                    # Convert string to int if needed (from frontend)
                    value = None
                    if isinstance(request.requests_per_day, str) and request.requests_per_day != "__keep__":
                        try:
                            value = int(request.requests_per_day)
                        except (ValueError, TypeError):
                            value = None  # Treat invalid as unlimited
                    elif isinstance(request.requests_per_day, int):
                        value = request.requests_per_day
                    elif request.requests_per_day is None:
                        value = None  # Explicitly unlimited
                    
                    await conn.execute(limit_sql, profile_id, value)

        result_data = BulkUpdateStaffResponse(
            success=True,
            message=f"{len(request.profileIds)} staff members updated successfully",
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

