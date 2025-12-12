"""Handler for quiz_complete WebSocket event."""

from typing import Any

from pydantic import BaseModel, ValidationError

from app.main import get_pool, sio, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)


# Pydantic models for server-to-client events
class CompleteQuizErrorPayload(BaseModel):
    success: bool
    message: str


class CompleteQuizResponsePayload(BaseModel):
    success: bool
    message: str
    allCorrect: bool


# Pydantic model for client-to-server event
class QuizCompletePayload(BaseModel):
    quizId: str


# Emit helper functions
async def quiz_complete_error(
    payload: CompleteQuizErrorPayload, room: str
) -> None:
    await sio.emit("quiz_complete_error", payload.model_dump(), room=room)


async def quiz_complete_response(
    payload: CompleteQuizResponsePayload, room: str
) -> None:
    await sio.emit("quiz_complete_response", payload.model_dump(), room=room)


async def _quiz_complete_impl(sid: str, data: QuizCompletePayload) -> None:
    """
    Handle quiz complete requests via WebSocket
    Replaces POST /api/v3/attempts/quizzes/complete endpoint
    """
    try:
        logger.info(
            f"Received quiz_complete request from {sid} with data: {data}"
        )

        quiz_id = data.quizId

        if not quiz_id:
            logger.error(f"Missing quizId in request from {sid}")
            await quiz_complete_error(
                CompleteQuizErrorPayload(
                    success=False, message="Missing quizId"
                ),
                room=sid,
            )
            return

        logger.info(
            f"Processing quiz complete: quiz_id={quiz_id}, sid={sid}"
        )

        # Get connection pool
        pool = get_pool()
        if not pool:
            await quiz_complete_error(
                CompleteQuizErrorPayload(
                    success=False, message="Database connection pool not available"
                ),
                room=sid,
            )
            logger.error(
                f"Emitted error to {sid}: Database connection pool not available"
            )
            return

        async with pool.acquire() as conn:
            # Complete quiz using SQL file within transaction
            async with transaction(conn):
                sql_query = load_sql(
                    "sql/v3/attempts/quizzes/complete_quiz_complete.sql"
                )
                result = await conn.fetchrow(sql_query, quiz_id)

                if not result:
                    await quiz_complete_error(
                        CompleteQuizErrorPayload(
                            success=False, message=f"Quiz not found: {quiz_id}"
                        ),
                        room=sid,
                    )
                    logger.error(f"Emitted error to {sid}: Quiz not found: {quiz_id}")
                    return

                all_correct = result.get("all_correct", False)

                # Invalidate cache after mutation
                tags = ["attempts", "quizzes"]
                await invalidate_tags(tags)
                logger.info(
                    f"Invalidated cache for tags: {tags} after completing quiz"
                )

                await quiz_complete_response(
                    CompleteQuizResponsePayload(
                        success=True,
                        message="Quiz completed successfully",
                        allCorrect=all_correct,
                    ),
                    room=sid,
                )
                logger.info(
                    f"Quiz completed successfully for {sid}: quiz_id={quiz_id}, all_correct={all_correct}"
                )

    except Exception as e:
        logger.error(f"Error completing quiz for {sid}: {str(e)}", exc_info=True)
        await quiz_complete_error(
            CompleteQuizErrorPayload(
                success=False, message=f"Failed to complete quiz: {str(e)}"
            ),
            room=sid,
        )
        logger.error(f"Emitted error to {sid}: Failed to complete quiz: {str(e)}")


@sio.event  # type: ignore
async def quiz_complete(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = QuizCompletePayload(**data)
        await _quiz_complete_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in quiz_complete for {sid}: {e}")
        await quiz_complete_error(
            CompleteQuizErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )

