"""Profile create endpoint - create a new profile."""

import uuid
from typing import Annotated, Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.infra.activity.audit import audit_activity, audit_set
from app.utils.cache.invalidate_tags import invalidate_tags
from app.infra.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql

router = APIRouter()


class CreateProfileRequest(BaseModel):
    """Request to create a single profile."""

    firstName: str
    lastName: str
    emails: list[str]  # List of emails (first one will be set as primary)
    primary_email_index: int | None = (
        None  # Index in emails array for primary (defaults to 0)
    )
    role: str
    cohort_ids: list[str] = []  # List of cohort IDs (no primary flag)
    department_ids: list[str] = []  # List of department IDs
    primary_department_index: int | None = (
        None  # Index in department_ids array for primary (defaults to 0)
    )


class CreateProfileResponse(BaseModel):
    """Response from create profile."""

    success: bool
    profileId: str
    message: str


@router.post(
    "/create",
    response_model=CreateProfileResponse,
    dependencies=[
        audit_activity(
            "profile.created",
            "{{ actor.name }} created profile '{{ profile.name }}'",
        )
    ],
)
async def create_profile(
    request: CreateProfileRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateProfileResponse:
    """Create a new profile."""
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

        # Generate new profile ID
        profile_id = str(uuid.uuid4())

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

        # Single consolidated query: validates email, creates profile, and inserts department
        # Note: For now, we create profile with primary email, then insert other emails
        # TODO: Update SQL to handle multiple emails in one query
        sql_query = load_sql("sql/v3/profile/staff/create_profile_complete.sql")
        sql_params = (
            profile_id,
            request.firstName,
            request.lastName,
            primary_email,
            request.role,
            True,  # active
            request.cohort_ids,
            request.department_ids,
            primary_dept_index,
            current_profile_id,  # For actor_name
        )

        async with transaction(conn):
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise HTTPException(status_code=500, detail="Failed to create profile")

            # Check if email already exists (returned from query)
            if result["email_exists"]:
                raise HTTPException(
                    status_code=400, detail=f"Email '{primary_email}' already exists"
                )

            # Verify profile was created
            if not result["id"]:
                raise HTTPException(status_code=500, detail="Failed to create profile")

            # Set audit context with data from SQL query
            actor_name = result.get("actor_name")
            profile_name = f"{request.firstName} {request.lastName}"
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": current_profile_id},
                    profile={"name": profile_name, "id": str(result["id"])},
                )

            # Insert additional emails (if any)
            if len(request.emails) > 1:
                insert_email_sql = """
                    INSERT INTO profile_emails (profile_id, email, is_primary, active)
                    SELECT $1::uuid, unnest($2::text[]), false, true
                    WHERE NOT EXISTS (SELECT 1 FROM profile_emails WHERE email = unnest($2::text[]) AND active = true)
                """
                # Get all emails except the primary one
                additional_emails = [
                    e for i, e in enumerate(request.emails) if i != primary_index
                ]
                if additional_emails:
                    await conn.execute(insert_email_sql, profile_id, additional_emails)

        result_data = CreateProfileResponse(
            success=True,
            profileId=str(result["id"]),
            message=f"Profile '{request.firstName} {request.lastName}' created successfully",
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
            route_path="/api/v3/profile/create",  # Constructed path since no Request
            operation="create_profile",
            sql_query=sql_query,
            sql_params=sql_params,
            request=None,
        )
