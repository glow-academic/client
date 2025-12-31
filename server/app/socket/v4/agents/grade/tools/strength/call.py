"""Handler for grading_tool_message_strength WebSocket event."""

import uuid
from typing import Any, cast

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.sql_helper import execute_sql_typed

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio, sio
from app.sql.types import (
    CreateMessageFeedbackHighlightSqlParams,
    CreateMessageFeedbackSqlParams,
    CreateMessageFeedbackSqlRow,
)

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
    profile_id: str | None = None  # Deprecated - retrieved from sid
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


async def _grading_tool_message_strength_impl(
    sid: str,
    data: MessageStrengthToolPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation for message strength feedback."""
    chat_id = data.chat_id
    trace_id = data.trace_id

    try:
        async with get_db_connection() as conn:
            grade_id_uuid = uuid.UUID(data.grade_id)

            # Map message number to message ID (reverse the mapping)
            number_to_id_map: dict[int, str] = {
                num: msg_id for msg_id, num in data.message_id_map.items()
            }

            if data.message_number not in number_to_id_map:
                error_msg = f"Message number {data.message_number} not found in message_id_map"
                await emit_to_client(
                    "grading_tools_message_strength_error",
                    MessageStrengthToolErrorPayload(
                        success=False,
                        chat_id=chat_id,
                        trace_id=trace_id,
                        message=error_msg,
                    ),
                    room=sid,
                )
                return

            message_id_str = number_to_id_map[data.message_number]
            try:
                message_id_uuid = uuid.UUID(message_id_str)
            except ValueError as e:
                error_msg = f"Invalid message ID format {message_id_str}: {e}"
                await emit_to_client(
                    "grading_tools_message_strength_error",
                    MessageStrengthToolErrorPayload(
                        success=False,
                        chat_id=chat_id,
                        trace_id=trace_id,
                        message=error_msg,
                    ),
                    room=sid,
                )
                return

            # Create message feedback record
            SQL_CREATE_FEEDBACK_PATH = "app/sql/v4/grading/create_message_feedback_complete.sql"
            feedback_params = CreateMessageFeedbackSqlParams(
                grade_id=grade_id_uuid,
                message_id=message_id_uuid,
                name="Strength",
                description=data.feedback,
                type="strength",  # type: ignore
            )
            feedback_result = cast(
                CreateMessageFeedbackSqlRow,
                await execute_sql_typed(conn, SQL_CREATE_FEEDBACK_PATH, params=feedback_params),
            )

            message_feedback_id = uuid.UUID(feedback_result.id)

            # Insert highlights if provided (using composite type array)
            if data.highlight:
                from app.sql.types import (
                    ICreateMessageFeedbackHighlightV3Highlight,
                )

                # Convert highlight strings to composite type objects
                highlight_objects = [
                    ICreateMessageFeedbackHighlightV3Highlight(section=section)
                    for section in data.highlight
                ]

                SQL_CREATE_HIGHLIGHTS_PATH = "app/sql/v4/grading/create_message_feedback_highlight_complete.sql"
                highlight_params = CreateMessageFeedbackHighlightSqlParams(
                    message_feedback_id=message_feedback_id,
                    highlights=highlight_objects,
                )
                await execute_sql_typed(conn, SQL_CREATE_HIGHLIGHTS_PATH, params=highlight_params)

            await emit_to_client(
                "grading_tools_message_strength_complete",
                MessageStrengthToolCompletePayload(
                    success=True,
                    chat_id=chat_id,
                    trace_id=trace_id,
                    message_feedback_id=str(message_feedback_id),
                    message=f"Strength feedback added to message {data.message_number}",
                ),
                room=sid,
            )

    except RuntimeError:
        await emit_to_client(
            "grading_tools_message_strength_error",
            MessageStrengthToolErrorPayload(
                success=False,
                chat_id=chat_id,
                trace_id=trace_id,
                message="Database connection pool not available",
            ),
            room=sid,
        )
    except Exception as e:
        await emit_to_client(
            "grading_tools_message_strength_error",
            MessageStrengthToolErrorPayload(
                success=False,
                chat_id=chat_id,
                trace_id=trace_id,
                message=str(e),
            ),
            room=sid,
        )


@internal_sio.on("grading_tool_message_strength")  # type: ignore
async def grading_tool_message_strength_internal(data: dict[str, Any]) -> None:
    """Handle message strength feedback event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=MessageStrengthToolPayload,
        handler=_grading_tool_message_strength_impl,  # type: ignore[arg-type]
        error_event_name="grading_tools_message_strength_error",
        error_response_type=MessageStrengthToolErrorPayload,
    )


# Register OpenAPI endpoints
register_client_endpoint(
    client_router,
    "/message_strength",
    MessageStrengthToolPayload,
    "Add strength feedback to a message",
)

register_client_endpoint(
    server_router,
    "/message_strength_complete",
    MessageStrengthToolCompletePayload,
    "Message strength tool completed successfully",
)

register_client_endpoint(
    server_router,
    "/message_strength_error",
    MessageStrengthToolErrorPayload,
    "Message strength tool error",
)
