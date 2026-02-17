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
    alias: str
    role: str
    requests_per_day: int | None
    primary_department_id: str
    active: bool
    default_profile: bool
    department_ids: list[str] | None = None
    intro_completed: bool | None = None
    chat_completed: bool | None = None


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
        # Single consolidated query: checks existence, updates profile, department, and request limit
        sql_query = load_sql("sql/v3/profile/staff/update_profile_complete.sql")
        sql_params = (
            request.profileId,
            request.first_name,
            request.last_name,
            request.alias,
            request.role,
            request.active,
            request.primary_department_id,
            request.requests_per_day,
            request.default_profile,
            request.intro_completed,
            request.chat_completed,
            request.department_ids,
        )

        async with transaction(conn):
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result or not result["id"]:
                raise HTTPException(
                    status_code=404, detail=f"Profile not found: {request.profileId}"
                )

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
