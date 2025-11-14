"""Staff bulk create endpoint - bulk create staff members."""

import uuid
from typing import Annotated, Any

import asyncpg
from app.api.v3.profile.staff.create import CreateStaffRequest
from app.db import get_db, transaction
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter()


class BulkCreateStaffRequest(BaseModel):
    """Request to bulk create staff members."""

    profiles: list[CreateStaffRequest]


class BulkCreateStaffResponse(BaseModel):
    """Response from bulk create staff."""

    success: bool
    profileIds: list[str]
    message: str


@router.post("/bulk-create", response_model=BulkCreateStaffResponse)
async def bulk_create_profile(
    request: BulkCreateStaffRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkCreateStaffResponse:
    """Bulk create profiles."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        # Check for duplicate aliases
        aliases = [p.alias for p in request.profiles]
        check_sql = load_sql("sql/v3/profile/staff/check_aliases_exist.sql")
        existing = await conn.fetch(check_sql, aliases)

        if existing:
            existing_aliases = [row["alias"] for row in existing]
            raise HTTPException(
                status_code=400,
                detail=f"Aliases already exist: {', '.join(existing_aliases)}",
            )

        # Create all profiles
        profile_ids: list[str] = []
        create_sql = load_sql("sql/v3/profile/staff/create_profile.sql")
        dept_sql = load_sql("sql/v3/profile/staff/insert_profile_department.sql")
        sql_query = create_sql  # Track primary query
        sql_params = ()  # Multiple queries with different params

        async with transaction(conn):
            for profile_req in request.profiles:
                profile_id = str(uuid.uuid4())
                profile_ids.append(profile_id)

                # Insert profile
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

                # If department_id is provided, insert profile_departments relationship
                if profile_req.department_id:
                    await conn.execute(dept_sql, profile_id, profile_req.department_id)

        result_data = BulkCreateStaffResponse(
            success=True,
            profileIds=profile_ids,
            message=f"{len(profile_ids)} staff members created successfully",
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
            operation="bulk_create_profile",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

