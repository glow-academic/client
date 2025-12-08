"""Submit quiz response endpoint - saves quiz response for question + option."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class SubmitQuizResponseRequest(BaseModel):
    quizId: str
    questionId: str
    optionId: str


class SubmitQuizResponseResponse(BaseModel):
    success: bool
    message: str
    isCorrect: bool


router = APIRouter()


@router.post("/submit-response", response_model=SubmitQuizResponseResponse)
async def submit_quiz_response(
    request: SubmitQuizResponseRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SubmitQuizResponseResponse:
    """Submit quiz response for question + option."""
    tags = ["attempts", "quizzes"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Submit response using SQL file
        sql_query = load_sql("sql/v3/attempts/quizzes/submit_response_complete.sql")
        sql_params = (request.quizId, request.questionId, request.optionId)
        result = await conn.fetchrow(
            sql_query, request.quizId, request.questionId, request.optionId
        )

        if not result:
            raise HTTPException(
                status_code=500, detail="Failed to submit quiz response"
            )

        is_correct = result.get("is_correct", False)

        result_data = SubmitQuizResponseResponse(
            success=True,
            message="Quiz response submitted successfully",
            isCorrect=is_correct,
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
            operation="submit_quiz_response",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
