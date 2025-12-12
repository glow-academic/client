"""Handler for quiz_submit_response WebSocket event."""

from typing import Any

from pydantic import BaseModel, ValidationError

from app.main import get_pool, sio, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)


# Pydantic models for server-to-client events
class SubmitQuizResponseErrorPayload(BaseModel):
    success: bool
    message: str


class SubmitQuizResponseResponsePayload(BaseModel):
    success: bool
    message: str
    isCorrect: bool


# Pydantic model for client-to-server event
class QuizSubmitResponsePayload(BaseModel):
    quizId: str
    questionId: str
    optionId: str


# Emit helper functions
async def quiz_submit_response_error(
    payload: SubmitQuizResponseErrorPayload, room: str
) -> None:
    await sio.emit("quiz_submit_response_error", payload.model_dump(), room=room)


async def quiz_submit_response_response(
    payload: SubmitQuizResponseResponsePayload, room: str
) -> None:
    await sio.emit("quiz_submit_response_response", payload.model_dump(), room=room)


async def _quiz_submit_response_impl(sid: str, data: QuizSubmitResponsePayload) -> None:
    """
    Handle quiz submit response requests via WebSocket
    Replaces POST /api/v3/attempts/quizzes/submit-response endpoint
    """
    try:
        logger.info(
            f"Received quiz_submit_response request from {sid} with data: {data}"
        )

        quiz_id = data.quizId
        question_id = data.questionId
        option_id = data.optionId

        if not quiz_id or not question_id or not option_id:
            logger.error(
                f"Missing quizId, questionId, or optionId in request from {sid}"
            )
            await quiz_submit_response_error(
                SubmitQuizResponseErrorPayload(
                    success=False,
                    message="Missing quizId, questionId, or optionId",
                ),
                room=sid,
            )
            return

        logger.info(
            f"Processing quiz submit response: quiz_id={quiz_id}, question_id={question_id}, option_id={option_id}, sid={sid}"
        )

        # Get connection pool
        pool = get_pool()
        if not pool:
            await quiz_submit_response_error(
                SubmitQuizResponseErrorPayload(
                    success=False, message="Database connection pool not available"
                ),
                room=sid,
            )
            logger.error(
                f"Emitted error to {sid}: Database connection pool not available"
            )
            return

        async with pool.acquire() as conn:
            # Submit response using SQL file within transaction
            async with transaction(conn):
                sql_query = load_sql(
                    "sql/v3/attempts/quizzes/submit_response_complete.sql"
                )
                result = await conn.fetchrow(sql_query, quiz_id, question_id, option_id)

                if not result:
                    await quiz_submit_response_error(
                        SubmitQuizResponseErrorPayload(
                            success=False, message="Failed to submit quiz response"
                        ),
                        room=sid,
                    )
                    logger.error(
                        f"Emitted error to {sid}: Failed to submit quiz response"
                    )
                    return

                is_correct = result.get("is_correct", False)

                # Invalidate cache after mutation
                tags = ["attempts", "quizzes"]
                await invalidate_tags(tags)
                logger.info(
                    f"Invalidated cache for tags: {tags} after submitting quiz response"
                )

                await quiz_submit_response_response(
                    SubmitQuizResponseResponsePayload(
                        success=True,
                        message="Quiz response submitted successfully",
                        isCorrect=is_correct,
                    ),
                    room=sid,
                )
                logger.info(
                    f"Quiz response submitted successfully for {sid}: is_correct={is_correct}"
                )

    except Exception as e:
        logger.error(
            f"Error submitting quiz response for {sid}: {str(e)}", exc_info=True
        )
        await quiz_submit_response_error(
            SubmitQuizResponseErrorPayload(
                success=False, message=f"Failed to submit quiz response: {str(e)}"
            ),
            room=sid,
        )
        logger.error(
            f"Emitted error to {sid}: Failed to submit quiz response: {str(e)}"
        )


@sio.event  # type: ignore
async def quiz_submit_response(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = QuizSubmitResponsePayload(**data)
        await _quiz_submit_response_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in quiz_submit_response for {sid}: {e}")
        await quiz_submit_response_error(
            SubmitQuizResponseErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )
