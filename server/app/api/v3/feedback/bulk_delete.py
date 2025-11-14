"""Feedback bulk delete endpoint."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.db import get_db
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class BulkDeleteFeedbackRequest(BaseModel):
    profileId: str
    ids: list[int]


class BulkDeleteFeedbackResponse(BaseModel):
    success: bool
    deleted_count: int
    message: str


router = APIRouter()


@router.post("/bulk-delete", response_model=BulkDeleteFeedbackResponse)
async def bulk_delete_feedback(
    request: BulkDeleteFeedbackRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkDeleteFeedbackResponse:
    """Bulk delete feedback. Only superadmin can delete feedback."""
    tags = ["feedback"]  # From router tags
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        # Check if user is superadmin
        check_sql = load_sql("sql/v3/feedback/check_profile_role.sql")
        sql_query = check_sql  # Track primary query
        sql_params = (request.profileId,)
        result = await conn.fetchrow(check_sql, request.profileId)

        if not result:
            raise HTTPException(status_code=404, detail=f"Profile not found: {request.profileId}")

        if result["role"] != "superadmin":
            raise HTTPException(
                status_code=403, detail="Only superadmin users can delete feedback"
            )

        if not request.ids:
            return BulkDeleteFeedbackResponse(
                success=True, deleted_count=0, message="No feedback to delete"
            )

        # Delete feedback
        delete_sql = load_sql("sql/v3/feedback/delete_feedback_bulk.sql")
        deleted_rows = await conn.fetch(delete_sql, request.ids)
        deleted_count = len(deleted_rows)

        result_data = BulkDeleteFeedbackResponse(
            success=True,
            deleted_count=deleted_count,
            message=f"Successfully deleted {deleted_count} feedback item(s)",
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
            operation="bulk_delete_feedback",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

