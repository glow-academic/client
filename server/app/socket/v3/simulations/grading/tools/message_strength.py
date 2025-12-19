"""Handler for grading_tool_message_strength WebSocket event."""

import json
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


class MessageStrengthToolPayload(BaseModel):
    """Request to add strength feedback to a message."""

    chat_id: str
    trace_id: str
    grade_id: str
    message_number: int
    feedback: str
    highlight: list[str] | None = None
    message_id_map: dict[str, int]
    profile_id: str | None = None
    sid: str | None = None


class MessageStrengthToolCompletePayload(BaseModel):
    """Response indicating message strength tool completed successfully."""

    success: bool
    chat_id: str
    trace_id: str
    message_feedback_id: str
    message: str | None = None


class MessageStrengthToolErrorPayload(BaseModel):
    """Response indicating an error occurred in message strength tool."""

    success: bool
    chat_id: str
    trace_id: str
    message: str


async def message_strength_tool_complete(
    payload: MessageStrengthToolCompletePayload, room: str
) -> None:
    logger.info(
        f"[grading_tool_message_strength_complete] Emitting complete event: "
        f"room={room}, trace_id={payload.trace_id}, chat_id={payload.chat_id}"
    )
    await sio.emit(
        "grading_tools_message_strength_complete", payload.model_dump(), room=room
    )
    logger.info(f"[grading_tool_message_strength_complete] Emitted to room={room}")


async def message_strength_tool_error(
    payload: MessageStrengthToolErrorPayload, room: str
) -> None:
    await sio.emit(
        "grading_tools_message_strength_error", payload.model_dump(), room=room
    )


async def _grading_tool_message_strength_impl(
    sid: str, data: dict[str, Any]
) -> str | None:
    """Internal implementation for message strength feedback."""
    logger.info(
        f"[grading_tool_message_strength] Handler received event: sid={sid}, "
        f"chat_id={data.get('chat_id', 'unknown')}, trace_id={data.get('trace_id', 'unknown')}"
    )

    try:
        validated = MessageStrengthToolPayload(**data)
    except ValidationError as e:
        logger.error(
            f"Validation error in grading_tool_message_strength for {sid}: {e}"
        )
        await message_strength_tool_error(
            MessageStrengthToolErrorPayload(
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
        await message_strength_tool_error(
            MessageStrengthToolErrorPayload(
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

            # Map message number to message ID (reverse the mapping)
            number_to_id_map: dict[int, str] = {
                num: msg_id for msg_id, num in validated.message_id_map.items()
            }

            if validated.message_number not in number_to_id_map:
                error_msg = f"Message number {validated.message_number} not found in message_id_map"
                logger.warning(error_msg)
                await message_strength_tool_error(
                    MessageStrengthToolErrorPayload(
                        success=False,
                        chat_id=chat_id,
                        trace_id=trace_id,
                        message=error_msg,
                    ),
                    room=f"simulation_{chat_id}",
                )
                return None

            message_id_str = number_to_id_map[validated.message_number]
            try:
                message_id_uuid = uuid.UUID(message_id_str)
            except ValueError as e:
                error_msg = f"Invalid message ID format {message_id_str}: {e}"
                logger.warning(error_msg)
                await message_strength_tool_error(
                    MessageStrengthToolErrorPayload(
                        success=False,
                        chat_id=chat_id,
                        trace_id=trace_id,
                        message=error_msg,
                    ),
                    room=f"simulation_{chat_id}",
                )
                return None

            # Create message feedback record
            sql_create_feedback = load_sql(
                "sql/v3/grading/create_message_feedback_complete.sql"
            )
            sql_query = sql_create_feedback
            sql_params = (
                str(grade_id_uuid),
                str(message_id_uuid),
                "Strength",  # name
                validated.feedback,  # description
                "strength",  # type
            )
            feedback_row = await conn.fetchrow(
                sql_create_feedback,
                str(grade_id_uuid),
                str(message_id_uuid),
                "Strength",
                validated.feedback,
                "strength",
            )

            if not feedback_row:
                await message_strength_tool_error(
                    MessageStrengthToolErrorPayload(
                        success=False,
                        chat_id=chat_id,
                        trace_id=trace_id,
                        message="Failed to create message feedback",
                    ),
                    room=f"simulation_{chat_id}",
                )
                return None

            message_feedback_id = uuid.UUID(feedback_row["id"])

            # Insert highlights if provided
            if validated.highlight:
                highlights_json = json.dumps(
                    [{"section": section} for section in validated.highlight]
                )
                sql_create_highlights = load_sql(
                    "sql/v3/grading/create_message_feedback_highlight.sql"
                )
                await conn.execute(
                    sql_create_highlights, str(message_feedback_id), highlights_json
                )
                logger.info(
                    f"✓ Created {len(validated.highlight)} highlight(s) for message feedback {message_feedback_id}"
                )

            logger.info(
                f"✓ Created message strength feedback for message {validated.message_number} "
                f"(message_id={message_id_uuid}, feedback_id={message_feedback_id})"
            )

            await message_strength_tool_complete(
                MessageStrengthToolCompletePayload(
                    success=True,
                    chat_id=chat_id,
                    trace_id=trace_id,
                    message_feedback_id=str(message_feedback_id),
                    message=f"Strength feedback added to message {validated.message_number}",
                ),
                room=f"simulation_{chat_id}",
            )

            return f"Strength feedback added to message {validated.message_number}"

    except Exception as e:
        logger.error(
            f"Error in grading_tool_message_strength for {sid}: {str(e)}", exc_info=True
        )
        await message_strength_tool_error(
            MessageStrengthToolErrorPayload(
                success=False,
                chat_id=chat_id,
                trace_id=trace_id,
                message=str(e),
            ),
            room=f"simulation_{chat_id}",
        )
        return None


@sio.event  # type: ignore
async def grading_tool_message_strength(sid: str, data: dict[str, Any]) -> None:
    """Handle message strength feedback event from grading tool (client-to-server)."""
    await _grading_tool_message_strength_impl(sid, data)


@internal_sio.on("grading_tool_message_strength")
async def grading_tool_message_strength_internal(data: dict[str, Any]) -> None:
    """Handle message strength feedback event from internal bus (server-to-server)."""
    sid = data.get("sid", "internal")
    # Remove sid from data before passing to implementation
    payload = {k: v for k, v in data.items() if k != "sid"}
    await _grading_tool_message_strength_impl(sid, payload)


# FastAPI endpoints for OpenAPI documentation
@client_router.post("/message_strength", response_model=dict[str, bool])
async def grading_tool_message_strength_api(
    request: MessageStrengthToolPayload,
) -> dict[str, bool]:
    """Client-to-server event: Add strength feedback to a message."""
    return {"success": True}


@server_router.post("/message_strength_complete", response_model=dict[str, bool])
async def message_strength_tool_complete_api(
    request: MessageStrengthToolCompletePayload,
) -> dict[str, bool]:
    """Server-to-client event: Message strength tool completed successfully."""
    return {"success": True}


@server_router.post("/message_strength_error", response_model=dict[str, bool])
async def message_strength_tool_error_api(
    request: MessageStrengthToolErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Message strength tool error."""
    return {"success": True}
