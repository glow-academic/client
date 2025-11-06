"""Logs bulk delete endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.db import get_db
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class BulkDeleteLogsRequest(BaseModel):
    profileId: str
    ids: list[int]


class BulkDeleteLogsResponse(BaseModel):
    success: bool
    deleted_count: int
    message: str


router = APIRouter()


@router.post("/bulk-delete", response_model=BulkDeleteLogsResponse)
async def bulk_delete_logs(
    request: BulkDeleteLogsRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkDeleteLogsResponse:
    """Bulk delete logs. Only superadmin can delete logs."""
    tags = ["logs"]  # From router tags
    
    try:
        if not request.ids:
            return BulkDeleteLogsResponse(
                success=True, deleted_count=0, message="No logs to delete"
            )

        # Bulk delete logs with role check in a single SQL file
        sql = load_sql("sql/v3/logs/bulk_delete_logs_complete.sql")
        result = await conn.fetchrow(sql, request.profileId, request.ids)

        if not result:
            # Profile doesn't exist
            raise HTTPException(
                status_code=404, detail=f"Profile not found: {request.profileId}"
            )

        # Check if user is superadmin
        if result["role"] != "superadmin":
            raise HTTPException(
                status_code=403, detail="Only superadmin users can delete logs"
            )

        deleted_count = result["deleted_count"]

        result_data = BulkDeleteLogsResponse(
            success=True,
            deleted_count=deleted_count,
            message=f"Successfully deleted {deleted_count} log(s)",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

