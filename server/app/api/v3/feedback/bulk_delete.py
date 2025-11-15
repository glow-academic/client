"""Feedback bulk delete endpoint."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
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
        if not request.ids:
            return BulkDeleteFeedbackResponse(
                success=True, deleted_count=0, message="No feedback to delete"
            )

        # Single consolidated query: role check + delete
        sql_query = load_sql("sql/v3/feedback/delete_feedback_bulk_with_validation.sql")
        sql_params = (request.profileId, request.ids)
        result = await conn.fetchrow(sql_query, request.profileId, request.ids)

        if not result:
            raise HTTPException(status_code=500, detail="Failed to delete feedback")

        deleted_count = result["deleted_count"]
        profile_role = result.get("profile_role")

        # Check if deletion was authorized (superadmin check)
        if deleted_count == 0 and len(request.ids) > 0:
            # Check if it's because user is not superadmin
            if profile_role and profile_role != "superadmin":
                raise HTTPException(
                    status_code=403, detail="Only superadmin users can delete feedback"
                )
            # Otherwise, feedback IDs might not exist

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
