"""Profile create or update endpoint - create or update a profile based on email."""

import uuid
from typing import Annotated, Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql

router = APIRouter()


class CreateOrUpdateProfileRequest(BaseModel):
    """Request to create or update a single profile."""

    firstName: str
    lastName: str
    emails: list[
        str
    ]  # List of emails (first one will be set as primary if primary_email_index not specified)
    primary_email_index: int | None = (
        None  # Index in emails array for primary (defaults to 0)
    )
    role: str
    department_ids: list[str] = []
    cohort_ids: list[str] = []


class CreateOrUpdateProfileResponse(BaseModel):
    """Response from create or update profile."""

    success: bool
    profileId: str
    created: bool  # True if created, False if updated
    message: str


@router.post("/upsert", response_model=CreateOrUpdateProfileResponse)
async def create_or_update_profile(
    request: CreateOrUpdateProfileRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateOrUpdateProfileResponse:
    """Create or update a profile based on email."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Validate emails array
        if not request.emails or len(request.emails) == 0:
            raise HTTPException(
                status_code=400, detail="At least one email is required"
            )

        # Determine primary email index (default to 0)
        primary_index = (
            request.primary_email_index
            if request.primary_email_index is not None
            else 0
        )
        if primary_index < 0 or primary_index >= len(request.emails):
            raise HTTPException(status_code=400, detail="Invalid primary_email_index")

        primary_email = request.emails[primary_index]

        # Convert string UUIDs to UUID arrays
        dept_uuids = (
            [uuid.UUID(d) for d in request.department_ids]
            if request.department_ids
            else []
        )
        cohort_uuids = (
            [uuid.UUID(c) for c in request.cohort_ids] if request.cohort_ids else []
        )

        # Single consolidated query for create/update with departments and cohorts
        sql_query = load_sql("sql/v3/profile/staff/create_or_update_staff_complete.sql")
        profile_id_new = uuid.uuid4()
        sql_params = (
            profile_id_new,
            request.firstName,
            request.lastName,
            primary_email,
            request.role,
            True,  # active
            dept_uuids,
            cohort_uuids,
            None,  # current_profile_id (no role validation for single create/update)
        )

        async with transaction(conn):
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise HTTPException(
                    status_code=500, detail="Failed to create or update profile"
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
                    profile_id,
                    email,
                    is_primary,
                )
            message = (
                f"Profile '{request.firstName} {request.lastName}' created successfully"
                if created
                else f"Profile '{request.firstName} {request.lastName}' updated successfully"
            )

        result_data = CreateOrUpdateProfileResponse(
            success=True, profileId=profile_id, created=created, message=message
        )

        # Invalidate cache after mutation
        tags = ["profile"]  # Profile operations
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_or_update_profile",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
