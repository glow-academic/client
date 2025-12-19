"""Handler for grading_tool_feedback WebSocket event."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import get_internal_sio, get_pool, sio
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class FeedbackToolPayload(BaseModel):
    """Request to create feedback for a standard group."""

    chat_id: str
    trace_id: str
    grade_id: str
    standard_group_id: str
    score: int
    feedback: str
    profile_id: str | None = None
    sid: str | None = None


class FeedbackToolCompletePayload(BaseModel):
    """Response indicating feedback tool completed successfully."""

    success: bool
    chat_id: str
    trace_id: str
    feedback_id: str
    message: str | None = None


class FeedbackToolErrorPayload(BaseModel):
    """Response indicating an error occurred in feedback tool."""

    success: bool
    chat_id: str
    trace_id: str
    message: str


async def feedback_tool_complete(
    payload: FeedbackToolCompletePayload, room: str
) -> None:
    logger.info(
        f"[grading_tool_feedback_complete] Emitting complete event: "
        f"room={room}, trace_id={payload.trace_id}, chat_id={payload.chat_id}"
    )
    await sio.emit("grading_tools_feedback_complete", payload.model_dump(), room=room)
    logger.info(f"[grading_tool_feedback_complete] Emitted to room={room}")


async def feedback_tool_error(payload: FeedbackToolErrorPayload, room: str) -> None:
    await sio.emit("grading_tools_feedback_error", payload.model_dump(), room=room)


async def _grading_tool_feedback_impl(sid: str, data: dict[str, Any]) -> str | None:
    """Internal implementation for standard group feedback."""
    logger.info(
        f"[grading_tool_feedback] Handler received event: sid={sid}, "
        f"chat_id={data.get('chat_id', 'unknown')}, trace_id={data.get('trace_id', 'unknown')}"
    )

    try:
        validated = FeedbackToolPayload(**data)
    except ValidationError as e:
        logger.error(f"Validation error in grading_tool_feedback for {sid}: {e}")
        await feedback_tool_error(
            FeedbackToolErrorPayload(
                success=False,
                chat_id=data.get("chat_id", "unknown"),
                trace_id=data.get("trace_id", "unknown"),
                message=f"Invalid payload: {str(e)}",
            ),
            room=f"simulation_{data.get('chat_id', 'unknown')}",
        )
        return None

    chat_id = validated.chat_id
    trace_id = validated.trace_id
    pool = get_pool()

    if not pool:
        await feedback_tool_error(
            FeedbackToolErrorPayload(
                success=False,
                chat_id=chat_id,
                trace_id=trace_id,
                message="Database connection pool not available",
            ),
            room=f"simulation_{chat_id}",
        )
        return None

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with pool.acquire() as conn:
            grade_id_uuid = uuid.UUID(validated.grade_id)
            standard_group_id_uuid = uuid.UUID(validated.standard_group_id)

            # Find the standard that matches the score for this standard group
            sql_find_standard = """
                SELECT id
                FROM standards
                WHERE standard_group_id = $1::uuid
                  AND points = $2::integer
                ORDER BY points DESC
                LIMIT 1
            """
            standard_row = await conn.fetchrow(
                sql_find_standard, str(standard_group_id_uuid), validated.score
            )

            if not standard_row:
                error_msg = (
                    f"No standard found for standard_group_id={validated.standard_group_id} "
                    f"with score={validated.score}"
                )
                logger.warning(error_msg)
                await feedback_tool_error(
                    FeedbackToolErrorPayload(
                        success=False,
                        chat_id=chat_id,
                        trace_id=trace_id,
                        message=error_msg,
                    ),
                    room=f"simulation_{chat_id}",
                )
                return None

            standard_id_uuid = uuid.UUID(standard_row["id"])

            # Create feedback record
            sql_create_feedback = load_sql("sql/v3/grading/create_feedback.sql")
            sql_query = sql_create_feedback
            sql_params = (
                str(grade_id_uuid),
                str(standard_id_uuid),
                validated.score,
                validated.feedback,
            )
            feedback_row = await conn.fetchrow(
                sql_create_feedback,
                str(grade_id_uuid),
                str(standard_id_uuid),
                validated.score,
                validated.feedback,
            )

            if not feedback_row:
                await feedback_tool_error(
                    FeedbackToolErrorPayload(
                        success=False,
                        chat_id=chat_id,
                        trace_id=trace_id,
                        message="Failed to create feedback",
                    ),
                    room=f"simulation_{chat_id}",
                )
                return None

            feedback_id = uuid.UUID(feedback_row["id"])

            logger.info(
                f"✓ Created feedback for standard_group {validated.standard_group_id} "
                f"with score {validated.score} (feedback_id={feedback_id})"
            )

            await feedback_tool_complete(
                FeedbackToolCompletePayload(
                    success=True,
                    chat_id=chat_id,
                    trace_id=trace_id,
                    feedback_id=str(feedback_id),
                    message=f"Feedback created for standard group with score {validated.score}",
                ),
                room=f"simulation_{chat_id}",
            )

            return f"Feedback created for standard group with score {validated.score}"

    except Exception as e:
        logger.error(
            f"Error in grading_tool_feedback for {sid}: {str(e)}", exc_info=True
        )
        await feedback_tool_error(
            FeedbackToolErrorPayload(
                success=False,
                chat_id=chat_id,
                trace_id=trace_id,
                message=str(e),
            ),
            room=f"simulation_{chat_id}",
        )
        return None


@sio.event  # type: ignore
async def grading_tool_feedback(sid: str, data: dict[str, Any]) -> None:
    """Handle feedback creation event from grading tool (client-to-server)."""
    await _grading_tool_feedback_impl(sid, data)


@internal_sio.on("grading_tool_feedback")
async def grading_tool_feedback_internal(data: dict[str, Any]) -> None:
    """Handle feedback creation event from internal bus (server-to-server)."""
    sid = data.get("sid", "internal")
    # Remove sid from data before passing to implementation
    payload = {k: v for k, v in data.items() if k != "sid"}
    await _grading_tool_feedback_impl(sid, payload)


# FastAPI endpoints for OpenAPI documentation
@client_router.post("/feedback", response_model=dict[str, bool])
async def grading_tool_feedback_api(request: FeedbackToolPayload) -> dict[str, bool]:
    """Client-to-server event: Create feedback for a standard group."""
    return {"success": True}


@server_router.post("/feedback_complete", response_model=dict[str, bool])
async def feedback_tool_complete_api(
    request: FeedbackToolCompletePayload,
) -> dict[str, bool]:
    """Server-to-client event: Feedback tool completed successfully."""
    return {"success": True}


@server_router.post("/feedback_error", response_model=dict[str, bool])
async def feedback_tool_error_api(request: FeedbackToolErrorPayload) -> dict[str, bool]:
    """Server-to-client event: Feedback tool error."""
    return {"success": True}

