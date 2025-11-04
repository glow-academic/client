"""Staff bulk delete endpoint - bulk delete staff members."""

from typing import Annotated

import asyncpg
from app.db import get_db
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
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
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkDeleteStaffResponse:
    """Bulk delete profiles."""
    try:
        # Check for default profiles
        check_sql = load_sql("sql/v3/profile/staff/bulk_check_default_profiles.sql")
        default_profiles = await conn.fetch(check_sql, request.profileIds)
        default_ids = [str(row["id"]) for row in default_profiles]

        # Filter out default profiles
        deletable_ids = [pid for pid in request.profileIds if pid not in default_ids]

        if not deletable_ids:
            raise HTTPException(
                status_code=400,
                detail="No profiles can be deleted (all are default profiles)",
            )

        # Delete profiles
        delete_sql = load_sql("sql/v3/profile/staff/bulk_delete_profiles.sql")
        await conn.execute(delete_sql, deletable_ids)

        message = f"{len(deletable_ids)} staff members deleted successfully"
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
        raise HTTPException(status_code=500, detail=str(e))

