"""Staff create or update endpoint - create or update a staff member based on alias."""

import uuid
from typing import Annotated, Any

import asyncpg
from app.db import get_db, transaction
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter()


class CreateOrUpdateStaffRequest(BaseModel):
    """Request to create or update a single staff member."""

    firstName: str
    lastName: str
    alias: str
    role: str
    department_ids: list[str] = []
    cohort_ids: list[str] = []


class CreateOrUpdateStaffResponse(BaseModel):
    """Response from create or update staff."""

    success: bool
    profileId: str
    created: bool  # True if created, False if updated
    message: str


@router.post("/create-or-update-staff", response_model=CreateOrUpdateStaffResponse)
async def create_or_update_staff(
    request: CreateOrUpdateStaffRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateOrUpdateStaffResponse:
    """Create or update a staff member based on alias."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        # Check if alias exists
        check_sql = load_sql("sql/v3/profile/staff/check_alias_exists.sql")
        sql_query = check_sql  # Track primary query
        sql_params = (request.alias,)
        existing = await conn.fetchrow(check_sql, request.alias)

        async with transaction(conn):
            if existing:
                # Update existing profile
                profile_id = str(existing["id"])

                # Update profile fields
                update_sql = load_sql("sql/v3/profile/staff/update_profile.sql")
                await conn.execute(update_sql, profile_id, request.role, True)  # active

                # Update firstName and lastName
                update_name_sql = """
                UPDATE profiles 
                SET first_name = $2, last_name = $3, updated_at = NOW()
                WHERE id = $1
                """
                await conn.execute(
                    update_name_sql, profile_id, request.firstName, request.lastName
                )

                # Update departments (handle array)
                if request.department_ids:
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
                    for idx, dept_id in enumerate(request.department_ids):
                        is_primary = idx == 0  # First department is primary
                        await conn.execute(insert_dept_sql, profile_id, dept_id, is_primary)
                elif request.department_ids == []:
                    # Empty array means remove all departments
                    delete_dept_sql = """
                    DELETE FROM profile_departments WHERE profile_id = $1
                    """
                    await conn.execute(delete_dept_sql, profile_id)

                # Update cohorts (handle array - only add new ones, don't remove existing)
                if request.cohort_ids:
                    # Get existing active cohorts for this profile
                    existing_cohorts_sql = """
                    SELECT cohort_id FROM cohort_profiles 
                    WHERE profile_id = $1 AND active = true
                    """
                    existing_cohorts = await conn.fetch(existing_cohorts_sql, profile_id)
                    existing_cohort_ids = {row["cohort_id"] for row in existing_cohorts}
                    
                    # Insert only cohorts that don't already exist
                    insert_cohort_sql = load_sql("sql/v3/profile/staff/insert_cohort_profile.sql")
                    for cohort_id in request.cohort_ids:
                        if cohort_id not in existing_cohort_ids:
                            await conn.execute(insert_cohort_sql, cohort_id, profile_id)

                created = False
                message = f"Staff '{request.firstName} {request.lastName}' updated successfully"
            else:
                # Create new profile
                profile_id = str(uuid.uuid4())

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

                # Insert departments (first one as primary)
                if request.department_ids:
                    insert_dept_sql = """
                    INSERT INTO profile_departments (profile_id, department_id, is_primary)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (profile_id, department_id) DO UPDATE SET
                        is_primary = EXCLUDED.is_primary,
                        active = true,
                        updated_at = NOW()
                    """
                    for idx, dept_id in enumerate(request.department_ids):
                        is_primary = idx == 0  # First department is primary
                        await conn.execute(insert_dept_sql, profile_id, dept_id, is_primary)

                # Insert cohorts
                if request.cohort_ids:
                    insert_cohort_sql = load_sql("sql/v3/profile/staff/insert_cohort_profile.sql")
                    for cohort_id in request.cohort_ids:
                        await conn.execute(insert_cohort_sql, cohort_id, profile_id)

                created = True
                message = f"Staff '{request.firstName} {request.lastName}' created successfully"

        result_data = CreateOrUpdateStaffResponse(
            success=True, profileId=profile_id, created=created, message=message
        )
        
        # Invalidate cache after mutation
        tags = ["staff", "profile"]  # Staff operations also affect profile cache
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_or_update_staff",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

