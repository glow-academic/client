"""Handler for grade_progress WebSocket event - dispatches to tool-specific handlers."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio

internal_sio = get_internal_sio()

server_router = APIRouter()


class GradeProgressPayload(BaseModel):
    """Generic grade progress event - dispatches to tool-specific handlers."""

    sid: str
    type: str  # "tool_call_start" | "tool_call_progress"
    chat_id: str
    run_id: str
    tool_name: str
    tool_call_id: str
    call_id: str | None = None
    arguments_raw: str


class GradeProgressErrorPayload(BaseModel):
    """Error response for grade progress."""

    success: bool
    message: str


async def _grade_progress_impl(
    sid: str,
    data: GradeProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Dispatch to tool-specific progress handler."""
    # Route to appropriate tool handler based on tool_name
    # Grade agent tools are dynamically created (one per standard group)
    # Tool names are like "grade_{safe_name}" where safe_name is the standard group safe name
    if data.type == "tool_call_start":
        # Emit tool-specific start event
        # All grade tools use the same handler (grade tool)
        if data.tool_name.startswith("grade_"):
            await internal_sio.emit(
                "grade_grade_progress",
                {
                    "sid": data.sid,
                    "type": "tool_call_start",
                    "chat_id": data.chat_id,
                    "run_id": data.run_id,
                    "tool_call_id": data.tool_call_id,
                    "call_id": data.call_id,
                    "tool_name": data.tool_name,
                    "arguments_raw": data.arguments_raw,
                },
            )

    elif data.type == "tool_call_progress":
        # Emit tool-specific progress event
        if data.tool_name.startswith("grade_"):
            await internal_sio.emit(
                "grade_grade_progress",
                {
                    "sid": data.sid,
                    "type": "tool_call_progress",
                    "chat_id": data.chat_id,
                    "run_id": data.run_id,
                    "tool_call_id": data.tool_call_id,
                    "call_id": data.call_id,
                    "tool_name": data.tool_name,
                    "arguments_raw": data.arguments_raw,
                },
            )


@internal_sio.on("grade_progress")  # type: ignore
async def grade_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle grade_progress event from internal bus."""
    # Only handle tool-related types
    if data.get("type") in ("tool_call_start", "tool_call_progress"):
        await handle_internal_event(
            data=data,
            request_type=GradeProgressPayload,
            handler=_grade_progress_impl,  # type: ignore[arg-type]
            error_event_name="grade_progress_error",
            error_response_type=GradeProgressErrorPayload,
        )


register_server_endpoint(
    server_router,
    "/grade_progress",
    GradeProgressPayload,
    "Dispatch grade progress to tool-specific handlers",
)
