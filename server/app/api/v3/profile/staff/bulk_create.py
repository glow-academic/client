"""Staff bulk create endpoint - bulk create staff members."""

import uuid
from typing import Annotated, Any

import asyncpg
from app.api.v3.profile.staff.create import CreateStaffRequest
from app.main import get_db, transaction
from app.utils.error.handle_route_error import handle_route_error
from app.utils.cache.invalidate_tags import invalidate_tags
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
        # Prepare arrays for bulk operation (maintain parallel structure)
        profile_ids = [str(uuid.uuid4()) for _ in request.profiles]
        first_names = [p.firstName for p in request.profiles]
        last_names = [p.lastName for p in request.profiles]
        aliases = [p.alias for p in request.profiles]
        roles = [p.role for p in request.profiles]
        # Department IDs must be parallel array (use None/null for profiles without departments)
        department_ids = [
            p.department_id if p.department_id else None for p in request.profiles
        ]

        # Single consolidated query: validates aliases, creates all profiles, and inserts departments
        sql_query = load_sql("sql/v3/profile/staff/bulk_create_profile_complete.sql")
        sql_params = (
            profile_ids,
            first_names,
            last_names,
            aliases,
            roles,
            department_ids if department_ids else [],
        )

        async with transaction(conn):
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise HTTPException(status_code=500, detail="Failed to create profiles")

            # Check if any aliases already exist
            existing_aliases = result.get("existing_aliases", [])
            if existing_aliases:
                raise HTTPException(
                    status_code=400,
                    detail=f"Aliases already exist: {', '.join(existing_aliases)}",
                )

            # Get created profile IDs
            created_ids = result.get("profile_ids", [])
            if not created_ids:
                raise HTTPException(status_code=500, detail="Failed to create profiles")

            profile_ids = [str(pid) for pid in created_ids]

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
