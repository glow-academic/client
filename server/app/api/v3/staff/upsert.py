"""Staff bulk create or update endpoint - bulk create or update staff members."""

import uuid
from typing import Annotated, Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.api.v3.profile.upsert import CreateOrUpdateProfileRequest
from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql

router = APIRouter()


class BulkCreateOrUpdateStaffRequest(BaseModel):
    """Request to bulk create or update staff members."""

    profiles: list[CreateOrUpdateProfileRequest]
    currentProfileId: str  # Current user's profile ID for role validation


class BulkCreateOrUpdateStaffResponse(BaseModel):
    """Response from bulk create or update staff."""

    success: bool
    profileIds: list[str]
    created_count: int
    updated_count: int
    message: str


@router.post("/upsert", response_model=BulkCreateOrUpdateStaffResponse)
async def bulk_create_or_update_staff(
    request: BulkCreateOrUpdateStaffRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkCreateOrUpdateStaffResponse:
    """Bulk create or update staff members."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_ids: list[str] = []
        created_count = 0
        updated_count = 0

        # Load consolidated SQL query with role validation built-in
        create_or_update_sql = load_sql(
            "sql/v3/profile/staff/create_or_update_staff_complete.sql"
        )
        sql_query = create_or_update_sql  # Track primary query

        async with transaction(conn):
            for profile_req in request.profiles:
                # Validate emails array
                if not profile_req.emails or len(profile_req.emails) == 0:
                    raise HTTPException(
                        status_code=400, detail="At least one email is required"
                    )

                # Determine primary email index (default to 0)
                primary_index = (
                    profile_req.primary_email_index
                    if profile_req.primary_email_index is not None
                    else 0
                )
                if primary_index < 0 or primary_index >= len(profile_req.emails):
                    raise HTTPException(
                        status_code=400, detail="Invalid primary_email_index"
                    )

                primary_email = profile_req.emails[primary_index]

                # Convert string UUIDs to UUID arrays
                dept_uuids = (
                    [uuid.UUID(d) for d in profile_req.department_ids]
                    if profile_req.department_ids
                    else []
                )
                cohort_uuids = (
                    [uuid.UUID(c) for c in profile_req.cohort_ids]
                    if profile_req.cohort_ids
                    else []
                )

                # Single consolidated query for create/update with departments, cohorts, and role validation
                profile_id_new = uuid.uuid4()
                sql_params = (
                    profile_id_new,
                    profile_req.firstName,
                    profile_req.lastName,
                    primary_email,
                    profile_req.role,
                    True,  # active
                    dept_uuids,
                    cohort_uuids,
                    uuid.UUID(
                        request.currentProfileId
                    ),  # current_profile_id for role validation
                )
                result = await conn.fetchrow(create_or_update_sql, *sql_params)

                if not result:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to create or update staff profile: {primary_email}",
                    )

                # Check for role validation error
                validation_error = result.get("validation_error")
                if validation_error:
                    raise HTTPException(
                        status_code=403,
                        detail=validation_error,
                    )

                profile_id = result["profile_id"]
                created = result["created"]

                # Update all emails: deactivate existing, then insert/activate new ones
                # First, deactivate all existing emails for this profile
                await conn.execute(
                    "UPDATE profile_emails SET active = false, updated_at = NOW() WHERE profile_id = $1",
                    profile_id,
                )

                # Insert/update all emails (set primary based on index)
                for i, email in enumerate(profile_req.emails):
                    is_primary = i == primary_index
                    await conn.execute(
                        """
                        INSERT INTO profile_emails (profile_id, email, is_primary, active)
                        VALUES ($1::uuid, $2, $3, true)
                        ON CONFLICT (profile_id, email) DO UPDATE SET
                            is_primary = EXCLUDED.is_primary,
                            active = true,
                            updated_at = NOW()
                    """,
                        profile_id,
                        email,
                        is_primary,
                    )

                if created:
                    created_count += 1
                else:
                    updated_count += 1

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
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="bulk_create_or_update_staff",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
