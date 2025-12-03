"""Video create endpoint - v3 API following DHH principles."""

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
    """Question item in create request."""

    question_text: str
    type: str  # 'choice' or 'frq'
    allow_multiple: bool = False
    times: list[int]  # Array of seconds when question appears
    options: list[QuestionOption]  # Only used for choice questions


class CreateVideoRequest(BaseModel):
    """Request to create a video."""

    name: str
    length_seconds: int
    upload_id: str | None = None
    department_ids: list[str] | None
    outline_ids: list[str] | None = None
    policy_ids: list[str] | None = None
    image_ids: list[str] | None = None
    active: bool = True
    questions: list[QuestionItem] = []  # Questions with times and options
    parameter_item_ids: list[str] | None = None  # Parameter items for video


class CreateVideoResponse(BaseModel):
    """Response from create operation."""

    success: bool
    videoId: str
    message: str


router = APIRouter()


@router.post("/create", response_model=CreateVideoResponse)
async def create_video(
    request: CreateVideoRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateVideoResponse:
    """Create a new video."""
    tags = ["videos"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Validate length_seconds
        if request.length_seconds <= 0:
            raise ValueError("length_seconds must be greater than 0")

        # Ensure arrays are not None (use empty arrays)
        department_ids = request.department_ids or []
        outline_ids = request.outline_ids or []
        policy_ids = request.policy_ids or []
        image_ids = request.image_ids or []
        questions = request.questions or []
        parameter_item_ids = request.parameter_item_ids or []

        # Prepare questions JSON for SQL
        questions_json = json.dumps([q.model_dump() for q in questions])

        # Create video with all relationships in a single SQL file
        sql_query = load_sql("sql/v3/videos/create_video_complete.sql")
        upload_id_uuid = None
        if request.upload_id:
            import uuid
            upload_id_uuid = uuid.UUID(request.upload_id)
        sql_params = (
            request.name,
            request.length_seconds,
            request.active,
            upload_id_uuid,
            department_ids if department_ids else None,
            outline_ids if outline_ids else None,
            policy_ids if policy_ids else None,
            image_ids if image_ids else None,
            questions_json,
            parameter_item_ids if parameter_item_ids else None,
        )
        result = await conn.fetchrow(sql_query, *sql_params)

        if not result:
            raise ValueError("Failed to create video")

        video_id = result["video_id"]

        result_data = CreateVideoResponse(
            success=True,
            videoId=video_id,
            message=f"Video '{request.name}' created successfully",
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
            operation="create_video",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

