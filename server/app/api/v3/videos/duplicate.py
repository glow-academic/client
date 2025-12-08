"""Video duplicate endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class DuplicateVideoRequest(BaseModel):
    """Request to duplicate a video."""

    videoId: str


class DuplicateVideoResponse(BaseModel):
    """Response from duplicate operation."""

    success: bool
    videoId: str
    message: str


router = APIRouter()


@router.post("/duplicate", response_model=DuplicateVideoResponse)
async def duplicate_video(
    request: DuplicateVideoRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateVideoResponse:
    """Duplicate a video."""
    tags = ["videos"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Use single comprehensive SQL file (DHH style)
            sql_query = load_sql("sql/v3/videos/duplicate_video.sql")
            sql_params = (request.videoId,)
            new_video_row = await conn.fetchrow(sql_query, request.videoId)

            if not new_video_row:
                raise ValueError(f"Video not found: {request.videoId}")

            new_video_id = new_video_row["video_id"]

            # Get original name for message
            original_name = await conn.fetchval(
                "SELECT name FROM videos WHERE id = $1", request.videoId
            )

            result_data = DuplicateVideoResponse(
                success=True,
                videoId=new_video_id,
                message=f"Video '{original_name}' duplicated successfully",
            )

            # Invalidate cache after mutation
            await invalidate_tags(tags)
            response.headers["X-Invalidate-Tags"] = ",".join(tags)

            return result_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="duplicate_video",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
