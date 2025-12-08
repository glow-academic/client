"""Video delete endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class DeleteVideoRequest(BaseModel):
    """Request to delete a video."""

    videoId: str


class DeleteVideoResponse(BaseModel):
    """Response from delete operation."""

    success: bool
    message: str


router = APIRouter()


@router.post("/delete", response_model=DeleteVideoResponse)
async def delete_video(
    request: DeleteVideoRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteVideoResponse:
    """Delete a video."""
    tags = ["videos"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Delete video with existence and usage checks in a single SQL file
        sql_query = load_sql("sql/v3/videos/delete_video_complete.sql")
        sql_params = (request.videoId,)
        result = await conn.fetchrow(sql_query, request.videoId)

        if not result:
            # Video doesn't exist
            raise HTTPException(
                status_code=404, detail=f"Video not found: {request.videoId}"
            )

        # Check if video was deleted or is in use
        if not result["deleted"]:
            # Video exists but is in use
            usage_count = result["usage_count"]
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete video that is in use by {usage_count} simulation(s)",
            )

        result_data = DeleteVideoResponse(
            success=True,
            message=f"Video '{result['name']}' deleted successfully",
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_video",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
