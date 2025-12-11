"""Handler for video_tool_questions WebSocket event."""

import json
import uuid
from typing import Any

from app.main import get_internal_sio, get_pool, sio
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)
internal_sio = get_internal_sio()


class QuestionsToolPayload(BaseModel):
    trace_id: str
    questions: list[
        dict[str, Any]
    ]  # List of question dicts with question_text, allow_multiple, options
    video_id: str | None = None
    question_timestamps: dict[str, list[int]] | None = (
        None  # Maps question IDs to timestamps
    )


class QuestionsToolCompletePayload(BaseModel):
    success: bool
    question_ids: list[str]
    trace_id: str
    message: str | None = None


class QuestionsToolErrorPayload(BaseModel):
    success: bool
    message: str
    trace_id: str


async def questions_tool_complete(
    payload: QuestionsToolCompletePayload, room: str
) -> None:
    logger.info(
        f"[video_tool_questions_complete] Emitting complete event: "
        f"room={room}, trace_id={payload.trace_id}, "
        f"question_ids={len(payload.question_ids)} questions"
    )
    await sio.emit("questions_tool_complete", payload.model_dump(), room=room)
    logger.info(f"[video_tool_questions_complete] Emitted to room={room}")


async def questions_tool_error(payload: QuestionsToolErrorPayload, room: str) -> None:
    await sio.emit("questions_tool_error", payload.model_dump(), room=room)


async def _video_tool_questions_impl(sid: str, data: dict[str, Any]) -> None:
    """Internal implementation for questions creation."""
    logger.info(
        f"[video_tool_questions] Handler received event: sid={sid}, "
        f"data={data}, trace_id={data.get('trace_id', 'unknown')}"
    )
    try:
        validated = QuestionsToolPayload(**data)
    except ValidationError as e:
        logger.error(f"Validation error in video_tool_questions for {sid}: {e}")
        await questions_tool_error(
            QuestionsToolErrorPayload(
                success=False,
                message=f"Invalid payload: {str(e)}",
                trace_id=data.get("trace_id", "unknown"),
            ),
            room=sid,
        )
        return

    trace_id = validated.trace_id
    pool = get_pool()

    if not pool:
        await questions_tool_error(
            QuestionsToolErrorPayload(
                success=False,
                message="Database connection pool not available",
                trace_id=trace_id,
            ),
            room=sid,
        )
        return

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with pool.acquire() as conn:
            video_id_uuid = (
                uuid.UUID(validated.video_id) if validated.video_id else None
            )

            # Convert questions to JSON format expected by SQL
            questions_json = json.dumps(validated.questions)

            # Create questions and link to video
            sql = load_sql("sql/v3/questions/create_questions_with_options.sql")
            sql_query = sql
            sql_params = (questions_json,)

            question_rows = await conn.fetch(sql, *sql_params)

            if not question_rows or len(question_rows) == 0:
                await questions_tool_error(
                    QuestionsToolErrorPayload(
                        success=False,
                        message="Failed to create questions",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            question_ids = [str(row["question_id"]) for row in question_rows]

            # Link questions to video if video_id provided
            if video_id_uuid:
                sql_link = load_sql("sql/v3/videos/link_questions_to_video.sql")
                try:
                    for question_id in question_ids:
                        await conn.execute(
                            sql_link,
                            str(video_id_uuid),
                            question_id,
                            True,  # active
                        )
                    logger.info(
                        f"✓ Linked {len(question_ids)} questions to video {video_id_uuid}"
                    )
                except Exception as e:
                    logger.warning(
                        f"Failed to link questions to video (may need to create SQL file): {e}"
                    )

                # Save question timestamps if provided
                if validated.question_timestamps:
                    timestamps_json = json.dumps(validated.question_timestamps)
                    sql_save_timestamps = load_sql(
                        "sql/v3/videos/save_question_timestamps.sql"
                    )
                    try:
                        await conn.execute(
                            sql_save_timestamps,
                            str(video_id_uuid),
                            timestamps_json,
                        )
                        logger.info(
                            f"✓ Saved question timestamps for video {video_id_uuid}"
                        )
                    except Exception as e:
                        logger.warning(f"Failed to save question timestamps: {e}")

            logger.info(
                f"✓ Created {len(question_ids)} questions "
                f"(video_id={validated.video_id}, trace_id={trace_id})"
            )

            await questions_tool_complete(
                QuestionsToolCompletePayload(
                    success=True,
                    question_ids=question_ids,
                    trace_id=trace_id,
                    message=f"Created {len(question_ids)} questions successfully",
                ),
                room=sid,
            )

    except Exception as e:
        logger.error(
            f"Error in video_tool_questions for {sid}: {str(e)}", exc_info=True
        )
        await questions_tool_error(
            QuestionsToolErrorPayload(success=False, message=str(e), trace_id=trace_id),
            room=sid,
        )


@sio.event  # type: ignore
async def video_tool_questions(sid: str, data: dict[str, Any]) -> None:
    """Handle questions creation event from video outline generation tool (client-to-server)."""
    await _video_tool_questions_impl(sid, data)


@internal_sio.on("video_tool_questions")
async def video_tool_questions_internal(data: dict[str, Any]) -> None:
    """Handle questions creation event from internal bus (server-to-server)."""
    sid = data.get("sid")
    if not sid:
        logger.error("[video_tool_questions_internal] Missing 'sid' in payload")
        return
    # Remove sid from data before passing to implementation
    payload = {k: v for k, v in data.items() if k != "sid"}
    await _video_tool_questions_impl(sid, payload)
