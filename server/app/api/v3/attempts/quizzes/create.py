"""Create quiz endpoint - creates quiz for attempt + video if doesn't exist."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class CreateQuizRequest(BaseModel):
    attemptId: str
    videoId: str


class CreateQuizResponse(BaseModel):
    success: bool
    message: str
    quizId: str | None = None


router = APIRouter()


@router.post("/create", response_model=CreateQuizResponse)
async def create_quiz(
    request: CreateQuizRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateQuizResponse:
    """Create quiz for attempt + video if doesn't exist."""
    tags = ["attempts", "quizzes"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Check if quiz already exists
        existing_quiz = await conn.fetchrow(
            """
            SELECT q.id
            FROM quizzes q
            JOIN attempt_quizzes aq ON aq.quiz_id = q.id
            WHERE aq.attempt_id = $1::uuid AND q.video_id = $2::uuid
            LIMIT 1
            """,
            request.attemptId,
            request.videoId,
        )

        if existing_quiz:
            return CreateQuizResponse(
                success=True,
                message="Quiz already exists",
                quizId=str(existing_quiz["id"]),
            )

        # Create quiz using SQL file
        sql_query = load_sql("sql/v3/attempts/quizzes/create_quiz_complete.sql")
        sql_params = (request.attemptId, request.videoId)
        result = await conn.fetchrow(sql_query, request.attemptId, request.videoId)

        if not result:
            raise HTTPException(status_code=500, detail="Failed to create quiz")

        quiz_id = result.get("quiz_id")
        if not quiz_id:
            raise HTTPException(
                status_code=500, detail="Quiz created but no ID returned"
            )

        result_data = CreateQuizResponse(
            success=True,
            message="Quiz created successfully",
            quizId=str(quiz_id),
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
            operation="create_quiz",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
