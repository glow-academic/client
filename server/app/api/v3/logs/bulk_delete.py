"""Logs bulk delete endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
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


@router.post("/bulk-delete")
async def bulk_delete_logs(
    request: BulkDeleteLogsRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkDeleteLogsResponse:
    """Bulk delete logs. Only superadmin can delete logs."""
    try:
        # Check if user is superadmin
        check_sql = load_sql("sql/v3/logs/check_profile_role.sql")
        result = await conn.fetchrow(check_sql, request.profileId)

        if not result:
            raise HTTPException(status_code=404, detail=f"Profile not found: {request.profileId}")

        if result["role"] != "superadmin":
            raise HTTPException(status_code=403, detail="Only superadmin users can delete logs")

        if not request.ids:
            return BulkDeleteLogsResponse(
                success=True, deleted_count=0, message="No logs to delete"
            )

        # Delete logs
        delete_sql = load_sql("sql/v3/logs/delete_logs_bulk.sql")
        deleted_rows = await conn.fetch(delete_sql, request.ids)
        deleted_count = len(deleted_rows)

        return BulkDeleteLogsResponse(
            success=True,
            deleted_count=deleted_count,
            message=f"Successfully deleted {deleted_count} log(s)",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

