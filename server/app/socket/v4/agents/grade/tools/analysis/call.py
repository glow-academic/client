"""Handler for analysis tool WebSocket event."""

import uuid
from typing import Any, cast

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.sql_helper import execute_sql_typed

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class AnalysisToolPayload(BaseModel):
    """Request to create analysis and link to grade."""

    chat_id: str
    trace_id: str
    grade_id: str
    content: str
    profile_id: str | None = None  # Deprecated - retrieved from sid
    sid: str | None = None


class AnalysisToolCompletePayload(BaseModel):
    """Response indicating analysis tool completed successfully."""

    success: bool
    chat_id: str
    trace_id: str
    analysis_id: str
    message: str | None = None


class AnalysisToolErrorPayload(BaseModel):
    """Response indicating an error occurred in analysis tool."""

    success: bool
    chat_id: str
    trace_id: str
    message: str


async def _grading_tool_analysis_impl(
    sid: str,
    data: dict[str, Any],
    profile_id: uuid.UUID | None = None,
    group_id: uuid.UUID | None = None,
) -> str | None:
    """Internal implementation for analysis tool.

    Creates an analysis record and links it to a grade via junction table.
    """
    try:
        validated = AnalysisToolPayload(**data)
    except ValidationError as e:
        error_msg = f"Invalid payload: {str(e)}"
        await emit_to_client(
            "grading_tools_analysis_error",
            AnalysisToolErrorPayload(
                success=False,
                chat_id=data.get("chat_id", "unknown"),
                trace_id=data.get("trace_id", "unknown"),
                message=error_msg,
            ),
            room=sid,
        )
        return None

    # Get profile_id from sid if not provided
    if not profile_id:
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            error_msg = "Profile not found for socket"
            await emit_to_client(
                "grading_tools_analysis_error",
                AnalysisToolErrorPayload(
                    success=False,
                    chat_id=validated.chat_id,
                    trace_id=validated.trace_id,
                    message=error_msg,
                ),
                room=sid,
            )
            return None
        profile_id = uuid.UUID(profile_id_str)

    chat_id = validated.chat_id
    trace_id = validated.trace_id

    try:
        async with get_db_connection() as conn:
            grade_id_uuid = uuid.UUID(validated.grade_id)

            # Create analysis record
            SQL_CREATE_ANALYSIS_PATH = (
                "app/sql/v4/analysis/create_analysis_complete.sql"
            )
            # SQL function: api_create_analysis_v4(content text) RETURNS TABLE (id text)
            analysis_row = await conn.fetchrow(
                "SELECT * FROM api_create_analysis_v4($1::text)",
                validated.content,
            )

            if not analysis_row or not analysis_row["id"]:
                error_msg = "Failed to create analysis record"
                await emit_to_client(
                    "grading_tools_analysis_error",
                    AnalysisToolErrorPayload(
                        success=False,
                        chat_id=chat_id,
                        trace_id=trace_id,
                        message=error_msg,
                    ),
                    room=sid,
                )
                return None

            analysis_id_uuid = uuid.UUID(analysis_row["id"])

            # Link analysis to grade via junction table
            SQL_LINK_ANALYSIS_PATH = (
                "app/sql/v4/analysis/link_analysis_to_grade_complete.sql"
            )
            # SQL function: api_link_analysis_to_grade_v4(analysis_id uuid, grade_id uuid) RETURNS TABLE (success boolean)
            link_row = await conn.fetchrow(
                "SELECT * FROM api_link_analysis_to_grade_v4($1::uuid, $2::uuid)",
                analysis_id_uuid,
                grade_id_uuid,
            )

            if not link_row:
                error_msg = "Failed to link analysis to grade"
                await emit_to_client(
                    "grading_tools_analysis_error",
                    AnalysisToolErrorPayload(
                        success=False,
                        chat_id=chat_id,
                        trace_id=trace_id,
                        message=error_msg,
                    ),
                    room=sid,
                )
                return None

            await emit_to_client(
                "grading_tools_analysis_complete",
                AnalysisToolCompletePayload(
                    success=True,
                    chat_id=chat_id,
                    trace_id=trace_id,
                    analysis_id=str(analysis_id_uuid),
                    message="Analysis created and linked to grade successfully",
                ),
                room=sid,
            )
            return None

    except RuntimeError:
        error_msg = "Database connection pool not available"
        await emit_to_client(
            "grading_tools_analysis_error",
            AnalysisToolErrorPayload(
                success=False,
                chat_id=chat_id,
                trace_id=trace_id,
                message=error_msg,
            ),
            room=sid,
        )
        return None
    except Exception as e:
        error_msg = str(e)
        await emit_to_client(
            "grading_tools_analysis_error",
            AnalysisToolErrorPayload(
                success=False,
                chat_id=chat_id,
                trace_id=trace_id,
                message=error_msg,
            ),
            room=sid,
        )
        return None


@internal_sio.on("grading_tool_analysis")  # type: ignore
async def grading_tool_analysis_internal(data: dict[str, Any]) -> None:
    """Handle analysis tool event from internal bus (server-to-server)."""
    sid = data.get("sid", "internal")
    # Remove sid from data before passing to implementation
    payload = {k: v for k, v in data.items() if k != "sid"}
    await _grading_tool_analysis_impl(sid, payload)


# Register OpenAPI endpoints
register_client_endpoint(
    client_router,
    "/analysis",
    AnalysisToolPayload,
    "Create analysis and link to grade",
)

register_client_endpoint(
    server_router,
    "/analysis_complete",
    AnalysisToolCompletePayload,
    "Analysis tool completed successfully",
)

register_client_endpoint(
    server_router,
    "/analysis_error",
    AnalysisToolErrorPayload,
    "Analysis tool error",
)

