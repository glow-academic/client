"""Handler for grading_tool_feedback WebSocket event."""

import uuid
from typing import Any, cast

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.sql_helper import execute_sql_typed

from app.infra.v3.websocket.get_db_connection import get_db_connection
from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_client_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio, sio
from app.sql.types import (
    CreateFeedbackSqlParams,
    CreateFeedbackSqlRow,
    FindStandardByGroupAndScoreSqlParams,
    FindStandardByGroupAndScoreSqlRow,
)

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
    profile_id: str | None = None  # Deprecated - retrieved from sid
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


async def _grading_tool_feedback_impl(
    sid: str,
    data: FeedbackToolPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation for standard group feedback."""
    chat_id = data.chat_id
    trace_id = data.trace_id

    try:
        async with get_db_connection() as conn:
            grade_id_uuid = uuid.UUID(data.grade_id)
            standard_group_id_uuid = uuid.UUID(data.standard_group_id)

            # Find the standard that matches the score for this standard group
            SQL_FIND_STANDARD_PATH = "app/sql/v3/grading/find_standard_by_group_and_score_complete.sql"
            find_standard_params = FindStandardByGroupAndScoreSqlParams(
                standard_group_id=standard_group_id_uuid,
                score=data.score,
            )
            standard_result = cast(
                FindStandardByGroupAndScoreSqlRow | None,
                await execute_sql_typed(conn, SQL_FIND_STANDARD_PATH, params=find_standard_params),
            )

            if not standard_result or not standard_result.id:
                error_msg = (
                    f"No standard found for standard_group_id={data.standard_group_id} "
                    f"with score={data.score}"
                )
                await emit_to_client(
                    "grading_tools_feedback_error",
                    FeedbackToolErrorPayload(
                        success=False,
                        chat_id=chat_id,
                        trace_id=trace_id,
                        message=error_msg,
                    ),
                    room=sid,
                )
                return

            standard_id_uuid = uuid.UUID(standard_result.id)

            # Create feedback record
            SQL_CREATE_FEEDBACK_PATH = "app/sql/v3/grading/create_feedback_complete.sql"
            feedback_params = CreateFeedbackSqlParams(
                grade_id=grade_id_uuid,
                standard_id=standard_id_uuid,
                total=data.score,
                feedback=data.feedback,
            )
            feedback_result = cast(
                CreateFeedbackSqlRow,
                await execute_sql_typed(conn, SQL_CREATE_FEEDBACK_PATH, params=feedback_params),
            )

            feedback_id = uuid.UUID(feedback_result.id)

            await emit_to_client(
                "grading_tools_feedback_complete",
                FeedbackToolCompletePayload(
                    success=True,
                    chat_id=chat_id,
                    trace_id=trace_id,
                    feedback_id=str(feedback_id),
                    message=f"Feedback created for standard group with score {data.score}",
                ),
                room=sid,
            )

    except RuntimeError:
        await emit_to_client(
            "grading_tools_feedback_error",
            FeedbackToolErrorPayload(
                success=False,
                chat_id=chat_id,
                trace_id=trace_id,
                message="Database connection pool not available",
            ),
            room=sid,
        )
    except Exception as e:
        await emit_to_client(
            "grading_tools_feedback_error",
            FeedbackToolErrorPayload(
                success=False,
                chat_id=chat_id,
                trace_id=trace_id,
                message=str(e),
            ),
            room=sid,
        )


@internal_sio.on("grading_tool_feedback")  # type: ignore
async def grading_tool_feedback_internal(data: dict[str, Any]) -> None:
    """Handle feedback creation event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=FeedbackToolPayload,
        handler=_grading_tool_feedback_impl,  # type: ignore[arg-type]
        error_event_name="grading_tools_feedback_error",
        error_response_type=FeedbackToolErrorPayload,
    )


# Register OpenAPI endpoints
register_client_endpoint(
    client_router,
    "/feedback",
    FeedbackToolPayload,
    "Create feedback for a standard group",
)

register_client_endpoint(
    server_router,
    "/feedback_complete",
    FeedbackToolCompletePayload,
    "Feedback tool completed successfully",
)

register_client_endpoint(
    server_router,
    "/feedback_error",
    FeedbackToolErrorPayload,
    "Feedback tool error",
)
