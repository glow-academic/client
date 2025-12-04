"""Video update endpoint - v3 API following DHH principles."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class QuestionOption(BaseModel):
    """Option for a question."""

    option_text: str
    type: str  # 'discrete' or 'freeform'
    is_correct: bool


class QuestionItem(BaseModel):
    """Question item in update request."""

    question_text: str
    type: str  # 'choice' or 'frq'
    allow_multiple: bool = False
    times: list[int]  # Array of seconds when question appears
    options: list[QuestionOption]  # Only used for choice questions


class UpdateVideoRequest(BaseModel):
    """Request to update a video."""

    videoId: str
    name: str
    length_seconds: int
    upload_id: str | None = None
    department_ids: list[str] | None
    outline_ids: list[str] | None = None
    policy_ids: list[str] | None = None
    upload_ids: list[str] | None = None
    image_names: list[str] | None = None
    active: bool
    questions: list[QuestionItem] = []  # Questions with times and options
    outline_agent_id: str | None = None
    image_agent_id: str | None = None
    parameter_item_ids: list[str] | None = None  # Parameter items for video


class UpdateVideoResponse(BaseModel):
    """Response from update operation."""

    success: bool
    message: str


router = APIRouter()


@router.post("/update", response_model=UpdateVideoResponse)
async def update_video(
    request: UpdateVideoRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateVideoResponse:
    """Update an existing video."""
    tags = ["videos"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Validate length_seconds
        if request.length_seconds <= 0:
            raise ValueError("length_seconds must be greater than 0")

        # Ensure arrays are not None (use empty arrays)
        # IMPORTANT: Always pass arrays (even if empty) to SQL, never None
        # This ensures proper handling of empty arrays vs missing data
        department_ids = request.department_ids or []
        outline_ids = request.outline_ids or []  # Always pass array, even if empty
        policy_ids = request.policy_ids or []
        upload_ids = request.upload_ids or []
        image_names = request.image_names or []
        questions = request.questions or []
        parameter_item_ids = request.parameter_item_ids or []

        # Validate upload_ids and image_names match in length
        if len(upload_ids) != len(image_names):
            raise ValueError("upload_ids and image_names must have the same length")

        # Prepare questions JSON for SQL
        questions_json = json.dumps([q.model_dump() for q in questions])

        # Prepare upload images JSON (array of objects with upload_id and name)
        upload_images_json = json.dumps([
            {"upload_id": upload_id, "name": name}
            for upload_id, name in zip(upload_ids, image_names)
        ]) if upload_ids and image_names else "[]"

        # Update video with all relationships in a single SQL file
        # Pass empty arrays instead of None to ensure proper SQL handling
        sql_query = load_sql("sql/v3/videos/update_video_complete.sql")
        import uuid
        upload_id_uuid = None
        if request.upload_id:
            upload_id_uuid = uuid.UUID(request.upload_id)
        sql_params = (
            request.videoId,
            request.name,
            request.length_seconds,
            request.active,
            upload_id_uuid,
            department_ids,  # Always pass array, SQL handles empty arrays
            outline_ids,  # Always pass array, SQL handles empty arrays
            policy_ids,  # Always pass array, SQL handles empty arrays
            upload_images_json,
            questions_json,
            request.outline_agent_id,
            request.image_agent_id,
            parameter_item_ids,  # Always pass array, SQL handles empty arrays
        )
        result = await conn.fetchrow(sql_query, *sql_params)

        if not result:
            raise HTTPException(
                status_code=404, detail=f"Video not found: {request.videoId}"
            )

        result_data = UpdateVideoResponse(
            success=True,
            message=f"Video '{result['name']}' updated successfully",
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
            operation="update_video",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

