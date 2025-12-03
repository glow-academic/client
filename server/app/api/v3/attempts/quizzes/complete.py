"""Complete quiz endpoint - marks quiz as completed and validates all answers."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


# Inline request/response schemas
class CompleteQuizRequest(BaseModel):
    quizId: str


class CompleteQuizResponse(BaseModel):
    success: bool
    message: str
    allCorrect: bool


router = APIRouter()


@router.post("/complete", response_model=CompleteQuizResponse)
async def complete_quiz(
    request: CompleteQuizRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CompleteQuizResponse:
    """Complete quiz - marks as completed and validates all answers are correct."""
    tags = ["attempts", "quizzes"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Complete quiz using SQL file
        sql_query = load_sql("sql/v3/attempts/quizzes/complete_quiz_complete.sql")
        sql_params = (request.quizId,)
        result = await conn.fetchrow(sql_query, request.quizId)

        if not result:
            raise HTTPException(
                status_code=404, detail=f"Quiz not found: {request.quizId}"
            )

        all_correct = result.get("all_correct", False)

        result_data = CompleteQuizResponse(
            success=True,
            message="Quiz completed successfully",
            allCorrect=all_correct,
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
            operation="complete_quiz",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

