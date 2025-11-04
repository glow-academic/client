"""Feedback bulk delete endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
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


@router.post("/bulk-delete")
async def bulk_delete_feedback(
    request: BulkDeleteFeedbackRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkDeleteFeedbackResponse:
    """Bulk delete feedback. Only superadmin can delete feedback."""
    try:
        # Check if user is superadmin
        check_sql = load_sql("sql/v3/feedback/check_profile_role.sql")
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

        return BulkDeleteFeedbackResponse(
            success=True,
            deleted_count=deleted_count,
            message=f"Successfully deleted {deleted_count} feedback item(s)",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

