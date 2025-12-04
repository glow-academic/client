"""Staff update endpoint - update a staff member."""

from typing import Annotated, Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql

router = APIRouter()


class UpdateStaffRequest(BaseModel):
    """Request to update staff."""

    profileId: str
    first_name: str
    last_name: str
    emails: list[str]  # List of emails (first one will be set as primary if primary_email_index not specified)
    primary_email_index: int | None = None  # Index in emails array for primary (defaults to 0)
    role: str
    requests_per_day: int | None
    primary_department_id: str
    active: bool


class UpdateStaffResponse(BaseModel):
    """Response from update staff."""

    success: bool
    message: str


@router.post("/update", response_model=UpdateStaffResponse)
async def update_profile(
    request: UpdateStaffRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateStaffResponse:
    """Update a profile."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Validate emails array
        if not request.emails or len(request.emails) == 0:
            raise HTTPException(status_code=400, detail="At least one email is required")

        # Determine primary email index (default to 0)
        primary_index = request.primary_email_index if request.primary_email_index is not None else 0
        if primary_index < 0 or primary_index >= len(request.emails):
            raise HTTPException(status_code=400, detail="Invalid primary_email_index")
        
        primary_email = request.emails[primary_index]

        # Single consolidated query: checks existence, updates profile, department, and request limit
        sql_query = load_sql("sql/v3/profile/staff/update_profile_complete.sql")
        sql_params = (
            request.profileId,
            request.first_name,
            request.last_name,
            primary_email,
            request.role,
            request.active,
            request.primary_department_id,
            request.requests_per_day,
        )

        async with transaction(conn):
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result or not result["id"]:
                raise HTTPException(
                    status_code=404, detail=f"Profile not found: {request.profileId}"
                )

            # Update all emails: deactivate existing, then insert/activate new ones
            # First, deactivate all existing emails for this profile
            await conn.execute(
                "UPDATE profile_emails SET active = false, updated_at = NOW() WHERE profile_id = $1",
                request.profileId
            )
            
            # Insert/update all emails (set primary based on index)
            for i, email in enumerate(request.emails):
                is_primary = (i == primary_index)
                await conn.execute("""
                    INSERT INTO profile_emails (profile_id, email, is_primary, active)
                    VALUES ($1::uuid, $2, $3, true)
                    ON CONFLICT (email) DO UPDATE SET
                        profile_id = EXCLUDED.profile_id,
                        is_primary = EXCLUDED.is_primary,
                        active = true,
                        updated_at = NOW()
                """, request.profileId, email, is_primary)

        result_data = UpdateStaffResponse(
            success=True, message=f"Staff '{result['name']}' updated successfully"
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
            operation="update_profile",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
