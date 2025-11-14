"""Staff delete endpoint - delete a staff member."""

from typing import Annotated, Any

import asyncpg
from app.db import get_db
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter()


class DeleteStaffRequest(BaseModel):
    """Request to delete staff."""

    profileId: str


class DeleteStaffResponse(BaseModel):
    """Response from delete staff."""

    success: bool
    message: str


@router.post("/delete", response_model=DeleteStaffResponse)
async def delete_profile(
    request: DeleteStaffRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteStaffResponse:
    """Delete a profile."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        # Check if profile is default
        check_sql = load_sql("sql/v3/profile/staff/check_default_profile.sql")
        sql_query = check_sql  # Track primary query
        sql_params = (request.profileId,)
        result = await conn.fetchrow(check_sql, request.profileId)

        if not result:
            raise HTTPException(
                status_code=404, detail=f"Profile not found: {request.profileId}"
            )

        if result["default_profile"]:
            raise HTTPException(status_code=400, detail="Cannot delete default profile")

        # Get profile name
        name_sql = load_sql("sql/v3/profile/staff/get_profile_name.sql")
        profile = await conn.fetchrow(name_sql, request.profileId)

        if not profile:
            raise HTTPException(
                status_code=404, detail=f"Profile not found: {request.profileId}"
            )

        # Delete profile
        delete_sql = load_sql("sql/v3/profile/staff/delete_profile.sql")
        await conn.execute(delete_sql, request.profileId)

        result_data = DeleteStaffResponse(
            success=True, message=f"Staff '{profile['name']}' deleted successfully"
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
            operation="delete_profile",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

