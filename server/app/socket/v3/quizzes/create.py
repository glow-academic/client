"""Handler for quiz_create WebSocket event."""

from typing import Any

from pydantic import BaseModel, ValidationError

from app.main import get_pool, sio, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)


# Pydantic models for server-to-client events
class CreateQuizErrorPayload(BaseModel):
    success: bool
    message: str


class CreateQuizResponsePayload(BaseModel):
    success: bool
    message: str
    quizId: str | None = None


# Pydantic model for client-to-server event
class QuizCreatePayload(BaseModel):
    attemptId: str
    videoId: str


# Emit helper functions
async def quiz_create_error(payload: CreateQuizErrorPayload, room: str) -> None:
    await sio.emit("quiz_create_error", payload.model_dump(), room=room)


async def quiz_create_response(payload: CreateQuizResponsePayload, room: str) -> None:
    await sio.emit("quiz_create_response", payload.model_dump(), room=room)


async def _quiz_create_impl(sid: str, data: QuizCreatePayload) -> None:
    """
    Handle quiz create requests via WebSocket
    Replaces POST /api/v3/attempts/quizzes/create endpoint
    """
    try:
        logger.info(f"Received quiz_create request from {sid} with data: {data}")

        attempt_id = data.attemptId
        video_id = data.videoId

        if not attempt_id or not video_id:
            logger.error(f"Missing attemptId or videoId in request from {sid}")
            await quiz_create_error(
                CreateQuizErrorPayload(
                    success=False, message="Missing attemptId or videoId"
                ),
                room=sid,
            )
            return

        logger.info(
            f"Processing quiz create: attempt_id={attempt_id}, video_id={video_id}, sid={sid}"
        )

        # Get connection pool
        pool = get_pool()
        if not pool:
            await quiz_create_error(
                CreateQuizErrorPayload(
                    success=False, message="Database connection pool not available"
                ),
                room=sid,
            )
            logger.error(
                f"Emitted error to {sid}: Database connection pool not available"
            )
            return

        async with pool.acquire() as conn:
            # Check if quiz already exists
            existing_quiz = await conn.fetchrow(
                """
                SELECT q.id
                FROM quizzes q
                JOIN attempt_quizzes aq ON aq.quiz_id = q.id
                WHERE aq.attempt_id = $1::uuid AND q.video_id = $2::uuid
                LIMIT 1
                """,
                attempt_id,
                video_id,
            )

            if existing_quiz:
                await quiz_create_response(
                    CreateQuizResponsePayload(
                        success=True,
                        message="Quiz already exists",
                        quizId=str(existing_quiz["id"]),
                    ),
                    room=sid,
                )
                logger.info(
                    f"Quiz already exists for attempt {attempt_id} and video {video_id}"
                )
                return

            # Create quiz using SQL file within transaction
            async with transaction(conn):
                sql_query = load_sql("sql/v3/attempts/quizzes/create_quiz_complete.sql")
                result = await conn.fetchrow(sql_query, attempt_id, video_id)

                if not result:
                    await quiz_create_error(
                        CreateQuizErrorPayload(
                            success=False, message="Failed to create quiz"
                        ),
                        room=sid,
                    )
                    logger.error(f"Emitted error to {sid}: Failed to create quiz")
                    return

                quiz_id = result.get("quiz_id")
                if not quiz_id:
                    await quiz_create_error(
                        CreateQuizErrorPayload(
                            success=False, message="Quiz created but no ID returned"
                        ),
                        room=sid,
                    )
                    logger.error(
                        f"Emitted error to {sid}: Quiz created but no ID returned"
                    )
                    return

                # Invalidate cache after mutation
                tags = ["attempts", "quizzes"]
                await invalidate_tags(tags)
                logger.info(
                    f"Invalidated cache for tags: {tags} after creating quiz {quiz_id}"
                )

                await quiz_create_response(
                    CreateQuizResponsePayload(
                        success=True,
                        message="Quiz created successfully",
                        quizId=str(quiz_id),
                    ),
                    room=sid,
                )
                logger.info(f"Quiz created successfully for {sid}: quiz_id={quiz_id}")

    except Exception as e:
        logger.error(f"Error creating quiz for {sid}: {str(e)}", exc_info=True)
        await quiz_create_error(
            CreateQuizErrorPayload(
                success=False, message=f"Failed to create quiz: {str(e)}"
            ),
            room=sid,
        )
        logger.error(f"Emitted error to {sid}: Failed to create quiz: {str(e)}")


@sio.event  # type: ignore
async def quiz_create(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = QuizCreatePayload(**data)
        await _quiz_create_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in quiz_create for {sid}: {e}")
        await quiz_create_error(
            CreateQuizErrorPayload(success=False, message=f"Invalid payload: {str(e)}"),
            room=sid,
        )
