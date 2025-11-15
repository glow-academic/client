"""Staff bulk delete endpoint - bulk delete staff members."""

from typing import Annotated, Any

import asyncpg
from app.main import get_db
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter()


class BulkDeleteStaffRequest(BaseModel):
    """Request to bulk delete staff."""

    profileIds: list[str]


class BulkDeleteStaffResponse(BaseModel):
    """Response from bulk delete staff."""

    success: bool
    message: str


@router.post("/bulk-delete", response_model=BulkDeleteStaffResponse)
async def bulk_delete_profile(
    request: BulkDeleteStaffRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkDeleteStaffResponse:
    """Bulk delete profiles."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        # Single consolidated query: checks defaults and deletes non-default profiles
        sql_query = load_sql("sql/v3/profile/staff/bulk_delete_profiles_complete.sql")
        sql_params = (request.profileIds,)
        
        result = await conn.fetchrow(sql_query, request.profileIds)

        if not result:
            raise HTTPException(
                status_code=500, detail="Failed to delete profiles"
            )

        deleted_count = result.get("deleted_count", 0)
        default_ids = result.get("default_profile_ids", [])

        if deleted_count == 0 and default_ids:
            raise HTTPException(
                status_code=400,
                detail="No profiles can be deleted (all are default profiles)",
            )

        message = f"{deleted_count} staff members deleted successfully"
        if default_ids:
            message += f" ({len(default_ids)} default profiles skipped)"

        result_data = BulkDeleteStaffResponse(success=True, message=message)
        
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
            operation="bulk_delete_profile",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

