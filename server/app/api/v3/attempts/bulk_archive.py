"""Attempts bulk archive endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.db import get_db
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class BulkArchiveAttemptsRequest(BaseModel):
    archived: bool
    attemptIds: list[str]


class BulkArchiveAttemptsResponse(BaseModel):
    success: bool
    message: str
    count: int


router = APIRouter()


@router.post("/bulk-archive", response_model=BulkArchiveAttemptsResponse)
async def bulk_archive_attempts(
    request: BulkArchiveAttemptsRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkArchiveAttemptsResponse:
    """Bulk archive or unarchive simulation attempts."""
    tags = ["attempts"]  # From router tags
    
    try:
        sql = load_sql("sql/v3/attempts/bulk_archive_attempts.sql")
        await conn.execute(sql, request.archived, request.attemptIds)

        action = "archived" if request.archived else "unarchived"
        count = len(request.attemptIds)

        result_data = BulkArchiveAttemptsResponse(
            success=True,
            message=f"{count} simulation attempt(s) {action} successfully",
            count=count,
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

