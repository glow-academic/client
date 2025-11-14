"""Attempts bulk archive endpoint."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.db import get_db
from app.utils.error_handler import handle_route_error
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
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkArchiveAttemptsResponse:
    """Bulk archive or unarchive simulation attempts."""
    tags = ["attempts"]  # From router tags
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        # Bulk archive attempts with count return in a single SQL file
        sql_query = load_sql("sql/v3/attempts/bulk_archive_attempts_complete.sql")
        sql_params = (request.archived, request.attemptIds)
        result = await conn.fetchrow(sql_query, request.archived, request.attemptIds)

        if not result:
            updated_count = 0
        else:
            updated_count = result["updated_count"]

        action = "archived" if request.archived else "unarchived"
        count = updated_count

        result_data = BulkArchiveAttemptsResponse(
            success=True,
            message=f"{count} simulation attempt(s) {action} successfully",
            count=count,
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="bulk_archive_attempts",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

