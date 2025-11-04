"""Staff bulk create or update endpoint - bulk create or update staff members."""

import uuid
from typing import Annotated

import asyncpg
from app.api.v3.profile.staff.create_or_update_staff import \
    CreateOrUpdateStaffRequest
from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

router = APIRouter()


class BulkCreateOrUpdateStaffRequest(BaseModel):
    """Request to bulk create or update staff members."""

    profiles: list[CreateOrUpdateStaffRequest]
    currentProfileId: str  # Current user's profile ID for role validation


class BulkCreateOrUpdateStaffResponse(BaseModel):
    """Response from bulk create or update staff."""

    success: bool
    profileIds: list[str]
    created_count: int
    updated_count: int
    message: str


@router.post("/bulk-create-or-update-staff", response_model=BulkCreateOrUpdateStaffResponse)
async def bulk_create_or_update_staff(
    request: BulkCreateOrUpdateStaffRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkCreateOrUpdateStaffResponse:
    """Bulk create or update staff members."""
    try:
        profile_ids: list[str] = []
        created_count = 0
        updated_count = 0

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

        check_alias_sql = load_sql("sql/v3/profile/staff/check_alias_exists.sql")
        create_sql = load_sql("sql/v3/profile/staff/create_profile.sql")
        update_sql = load_sql("sql/v3/profile/staff/update_profile.sql")
        insert_cohort_sql = load_sql("sql/v3/profile/staff/insert_cohort_profile.sql")

        async with transaction(conn):
            for profile_req in request.profiles:
                # Validate role assignment
                if not can_assign_role(current_user_role, profile_req.role):
                    raise HTTPException(
                        status_code=403,
                        detail=f"Cannot assign role '{profile_req.role}' with current role '{current_user_role}'.",
                    )
                
                # Check if alias exists
                existing = await conn.fetchrow(check_alias_sql, profile_req.alias)

                if existing:
                    # Update existing
                    profile_id = str(existing["id"])

                    # Update profile
                    await conn.execute(update_sql, profile_id, profile_req.role, True)

                    # Update name
                    update_name_sql = """
                    UPDATE profiles 
                    SET first_name = $2, last_name = $3, updated_at = NOW()
                    WHERE id = $1
                    """
                    await conn.execute(
                        update_name_sql, profile_id, profile_req.firstName, profile_req.lastName
                    )

                    # Update departments (handle array)
                    if profile_req.department_ids:
                        # First, delete any existing department relationships
                        delete_dept_sql = """
                        DELETE FROM profile_departments WHERE profile_id = $1
                        """
                        await conn.execute(delete_dept_sql, profile_id)
                        # Then insert all new ones (first one as primary)
                        insert_dept_sql = """
                        INSERT INTO profile_departments (profile_id, department_id, is_primary)
                        VALUES ($1, $2, $3)
                        ON CONFLICT (profile_id, department_id) DO UPDATE SET
                            is_primary = EXCLUDED.is_primary,
                            active = true,
                            updated_at = NOW()
                        """
                        for idx, dept_id in enumerate(profile_req.department_ids):
                            is_primary = idx == 0  # First department is primary
                            await conn.execute(insert_dept_sql, profile_id, dept_id, is_primary)
                    elif profile_req.department_ids == []:
                        # Empty array means remove all departments
                        delete_dept_sql = """
                        DELETE FROM profile_departments WHERE profile_id = $1
                        """
                        await conn.execute(delete_dept_sql, profile_id)

                    # Update cohorts (handle array - only add new ones, don't remove existing)
                    if profile_req.cohort_ids:
                        # Get existing active cohorts for this profile
                        existing_cohorts_sql = """
                        SELECT cohort_id FROM cohort_profiles 
                        WHERE profile_id = $1 AND active = true
                        """
                        existing_cohorts = await conn.fetch(existing_cohorts_sql, profile_id)
                        existing_cohort_ids = {row["cohort_id"] for row in existing_cohorts}
                        
                        # Insert only cohorts that don't already exist
                        for cohort_id in profile_req.cohort_ids:
                            if cohort_id not in existing_cohort_ids:
                                await conn.execute(insert_cohort_sql, cohort_id, profile_id)

                    updated_count += 1
                else:
                    # Create new
                    profile_id = str(uuid.uuid4())

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

                    # Insert departments (first one as primary)
                    if profile_req.department_ids:
                        insert_dept_sql = """
                        INSERT INTO profile_departments (profile_id, department_id, is_primary)
                        VALUES ($1, $2, $3)
                        ON CONFLICT (profile_id, department_id) DO UPDATE SET
                            is_primary = EXCLUDED.is_primary,
                            active = true,
                            updated_at = NOW()
                        """
                        for idx, dept_id in enumerate(profile_req.department_ids):
                            is_primary = idx == 0  # First department is primary
                            await conn.execute(insert_dept_sql, profile_id, dept_id, is_primary)

                    # Insert cohorts
                    if profile_req.cohort_ids:
                        for cohort_id in profile_req.cohort_ids:
                            await conn.execute(insert_cohort_sql, cohort_id, profile_id)

                    created_count += 1

                profile_ids.append(str(profile_id))

        result_data = BulkCreateOrUpdateStaffResponse(
            success=True,
            profileIds=profile_ids,
            created_count=created_count,
            updated_count=updated_count,
            message=f"{created_count} created, {updated_count} updated successfully",
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

