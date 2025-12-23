"""Profile update endpoint - update profile fields."""

from datetime import UTC, datetime
from typing import Annotated, Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.infra.activity.audit import audit_activity, audit_set
from utils.cache.invalidate_tags import invalidate_tags
from app.infra.error.handle_route_error import handle_route_error
from utils.sql_helper import load_sql

router = APIRouter()


class UpdateProfileRequest(BaseModel):
    """Request to update profile - supports both simple and comprehensive updates."""

    profileId: str  # Target profile ID to update (kept in body as it's the target, not current user)
    # Current user's profileId comes from X-Profile-Id header (request.state.profile_id)
    # Simple fields (for auth updates)
    firstName: str | None = None
    lastName: str | None = None
    lastLogin: str | None = None  # ISO datetime
    role: str | None = None
    active: bool | None = None
    reqPerDay: int | None = None
    lastActive: str | None = None  # ISO datetime
    # Comprehensive fields (for staff management)
    first_name: str | None = None
    last_name: str | None = None
    emails: list[str] | None = (
        None  # List of emails (first one will be set as primary if primary_email_index not specified)
    )
    primary_email_index: int | None = (
        None  # Index in emails array for primary (defaults to 0)
    )
    requests_per_day: int | None = None
    cohort_ids: list[str] | None = None  # List of cohort IDs (no primary flag)
    department_ids: list[str] | None = None  # List of department IDs
    primary_department_index: int | None = (
        None  # Index in department_ids array for primary (defaults to 0)
    )


class UpdateProfileResponse(BaseModel):
    """Response from update profile."""

    success: bool
    message: str


@router.post(
    "/update",
    response_model=UpdateProfileResponse,
    dependencies=[
        audit_activity(
            "profile.updated", "{{ actor.name }} updated profile '{{ profile.name }}'"
        )
    ],
)
async def update_profile(
    request: UpdateProfileRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateProfileResponse:
    """Update profile fields - supports both simple auth updates and comprehensive staff updates."""
    tags = ["profile"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        current_profile_id = http_request.state.profile_id
        if not current_profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Determine if this is a comprehensive update (has emails, cohorts, departments)
        is_comprehensive = (
            request.emails is not None
            or request.cohort_ids is not None
            or request.department_ids is not None
        )

        if is_comprehensive:
            # Comprehensive update (staff management)
            # Validate emails array
            if request.emails is not None and len(request.emails) == 0:
                raise HTTPException(
                    status_code=400, detail="At least one email is required"
                )

            # Use first_name/last_name if provided, otherwise fall back to firstName/lastName
            first_name = request.first_name or request.firstName or ""
            last_name = request.last_name or request.lastName or ""

            if not first_name or not last_name:
                raise HTTPException(
                    status_code=400, detail="first_name and last_name are required"
                )

            # Determine primary email index (default to 0)
            primary_index = (
                request.primary_email_index
                if request.primary_email_index is not None
                else 0
            )
            if request.emails and (
                primary_index < 0 or primary_index >= len(request.emails)
            ):
                raise HTTPException(
                    status_code=400, detail="Invalid primary_email_index"
                )

            primary_email = request.emails[primary_index] if request.emails else ""

            # Determine primary department index (default to 0)
            primary_dept_index = (
                request.primary_department_index
                if request.primary_department_index is not None
                else (0 if request.department_ids else None)
            )
            if request.department_ids and (
                primary_dept_index is None
                or primary_dept_index < 0
                or primary_dept_index >= len(request.department_ids)
            ):
                raise HTTPException(
                    status_code=400, detail="Invalid primary_department_index"
                )

            # Single consolidated query: checks existence, updates profile, department, and request limit
            sql_query = load_sql("app/sql/v3/profile/staff/update_profile_complete.sql")
            sql_params = (
                request.profileId,
                first_name,
                last_name,
                primary_email,
                request.role or "",
                request.active if request.active is not None else True,
                request.cohort_ids or [],
                request.department_ids or [],
                primary_dept_index,
                request.requests_per_day or request.reqPerDay,
                current_profile_id,  # For actor_name
            )

            async with transaction(conn):
                result = await conn.fetchrow(sql_query, *sql_params)

                if not result or not result["id"]:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Profile not found: {request.profileId}",
                    )

                # Update all emails: deactivate existing, then insert/activate new ones
                if request.emails:
                    # First, deactivate all existing emails for this profile
                    await conn.execute(
                        "UPDATE profile_emails SET active = false, updated_at = NOW() WHERE profile_id = $1",
                        request.profileId,
                    )

                    # Insert/update all emails (set primary based on index)
                    for i, email in enumerate(request.emails):
                        is_primary = i == primary_index
                        await conn.execute(
                            """
                            INSERT INTO profile_emails (profile_id, email, is_primary, active)
                            VALUES ($1::uuid, $2, $3, true)
                            ON CONFLICT (email) DO UPDATE SET
                                profile_id = EXCLUDED.profile_id,
                                is_primary = EXCLUDED.is_primary,
                                active = true,
                                updated_at = NOW()
                        """,
                            request.profileId,
                            email,
                            is_primary,
                        )

            # Set audit context with data from SQL query
            actor_name = result.get("actor_name")
            profile_name = result.get("name")
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": current_profile_id},
                    profile={"name": profile_name, "id": request.profileId},
                )

            result_data = UpdateProfileResponse(
                success=True,
                message=f"Profile '{result['name']}' updated successfully",
            )
        else:
            # Simple update (auth updates)
            # Process lastLogin ISO string to datetime if present
            last_login_dt = None
            if request.lastLogin:
                try:
                    last_login_dt = datetime.fromisoformat(
                        request.lastLogin.replace("Z", "+00:00")
                    )
                    if last_login_dt.tzinfo is None:
                        last_login_dt = last_login_dt.replace(tzinfo=UTC)
                except (ValueError, AttributeError):
                    pass

            # Process lastActive ISO string to datetime if present
            last_active_dt = None
            if request.lastActive:
                try:
                    last_active_dt = datetime.fromisoformat(
                        request.lastActive.replace("Z", "+00:00")
                    )
                    if last_active_dt.tzinfo is None:
                        last_active_dt = last_active_dt.replace(tzinfo=UTC)
                except (ValueError, AttributeError):
                    pass

            # Update profile with all fields in a single SQL file
            # Pass None for fields that aren't being updated (SQL uses COALESCE to keep existing values)
            # Note: req_per_day is stored in profile_request_limits table, not updated here
            sql_query = load_sql("app/sql/v3/profile/update_profile_complete.sql")
            sql_params = (
                request.profileId,  # $1
                request.firstName,  # $2
                request.lastName,  # $3
                last_login_dt,  # $4
                request.role,  # $5
                request.active,  # $6
                None,  # $7 - req_per_day (not used, stored in separate table)
                last_active_dt,  # $8
                current_profile_id,  # $9 - For actor_name
            )
            row = await conn.fetchrow(
                sql_query,
                request.profileId,  # $1
                request.firstName,  # $2
                request.lastName,  # $3
                last_login_dt,  # $4
                request.role,  # $5
                request.active,  # $6
                None,  # $7 - req_per_day (not used, stored in separate table)
                last_active_dt,  # $8
                current_profile_id,  # $9 - For actor_name
            )

            if not row:
                raise HTTPException(status_code=404, detail="Profile not found")

            # Set audit context with data from SQL query
            actor_name = row.get("actor_name")
            profile_name = (
                f"{row.get('first_name', '')} {row.get('last_name', '')}".strip()
            )
            if actor_name and profile_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": current_profile_id},
                    profile={"name": profile_name, "id": request.profileId},
                )

            result_data = UpdateProfileResponse(
                success=True, message="Profile updated successfully"
            )

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
