"""Staff create endpoint - create a new staff member."""

import uuid
from typing import Annotated, Any

import asyncpg
from app.main import get_db, transaction
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter()


class CreateStaffRequest(BaseModel):
    """Request to create a single staff member."""

    firstName: str
    lastName: str
    alias: str
    role: str
    department_id: str | None = None


class CreateStaffResponse(BaseModel):
    """Response from create staff."""

    success: bool
    profileId: str
    message: str


@router.post("/create", response_model=CreateStaffResponse)
async def create_profile(
    request: CreateStaffRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateStaffResponse:
    """Create a new profile."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Generate new profile ID
        profile_id = str(uuid.uuid4())

        # Single consolidated query: validates alias, creates profile, and inserts department
        sql_query = load_sql("sql/v3/profile/staff/create_profile_complete.sql")
        sql_params = (
            profile_id,
            request.firstName,
            request.lastName,
            request.alias,
            request.role,
            True,  # active
            False,  # default_profile
            False,  # viewed_intro
            False,  # viewed_chat
            request.department_id,
        )

        async with transaction(conn):
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise HTTPException(status_code=500, detail="Failed to create profile")

            # Check if alias already exists (returned from query)
            if result["alias_exists"]:
                raise HTTPException(
                    status_code=400, detail=f"Alias '{request.alias}' already exists"
                )

            # Verify profile was created
            if not result["id"]:
                raise HTTPException(status_code=500, detail="Failed to create profile")

        result_data = CreateStaffResponse(
            success=True,
            profileId=str(result["id"]),
            message=f"Staff '{request.firstName} {request.lastName}' created successfully",
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
            route_path="/api/v3/profile/staff/create",  # Constructed path since no Request
            operation="create_profile",
            sql_query=sql_query,
            sql_params=sql_params,
            request=None,
        )
