"""Handler for rubric_progress WebSocket event - dispatches to tool-specific handlers."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio

internal_sio = get_internal_sio()

server_router = APIRouter()


class RubricProgressPayload(BaseModel):
    """Generic rubric progress event - dispatches to tool-specific handlers."""

    sid: str
    type: str  # "tool_call_start" | "tool_call_progress"
    rubric_id: str | None = None
    run_id: str
    tool_name: str
    tool_call_id: str
    call_id: str | None = None
    arguments_raw: str


class RubricProgressErrorPayload(BaseModel):
    """Error response for rubric progress."""

    success: bool
    message: str


async def _rubric_progress_impl(
    sid: str,
    data: RubricProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Dispatch to tool-specific progress handler."""
    # Route to appropriate tool handler based on tool_name
    if data.type == "tool_call_start":
        # Emit tool-specific start event
        if data.tool_name == "standard_description":
            await internal_sio.emit(
                "rubric_standard_description_progress",
                {
                    "sid": data.sid,
                    "type": "tool_call_start",
                    "rubric_id": data.rubric_id,
                    "run_id": data.run_id,
                    "tool_call_id": data.tool_call_id,
                    "call_id": data.call_id,
                    "tool_name": data.tool_name,
                    "arguments_raw": data.arguments_raw,
                },
            )
        elif data.tool_name == "create_title":
            await internal_sio.emit(
                "rubric_title_progress",
                {
                    "sid": data.sid,
                    "type": "tool_call_start",
                    "rubric_id": data.rubric_id,
                    "run_id": data.run_id,
                    "tool_call_id": data.tool_call_id,
                    "call_id": data.call_id,
                    "tool_name": data.tool_name,
                    "arguments_raw": data.arguments_raw,
                },
            )

    elif data.type == "tool_call_progress":
        # Emit tool-specific progress event
        if data.tool_name == "standard_description":
            await internal_sio.emit(
                "rubric_standard_description_progress",
                {
                    "sid": data.sid,
                    "type": "tool_call_progress",
                    "rubric_id": data.rubric_id,
                    "run_id": data.run_id,
                    "tool_call_id": data.tool_call_id,
                    "call_id": data.call_id,
                    "tool_name": data.tool_name,
                    "arguments_raw": data.arguments_raw,
                },
            )
        elif data.tool_name == "create_title":
            await internal_sio.emit(
                "rubric_title_progress",
                {
                    "sid": data.sid,
                    "type": "tool_call_progress",
                    "rubric_id": data.rubric_id,
                    "run_id": data.run_id,
                    "tool_call_id": data.tool_call_id,
                    "call_id": data.call_id,
                    "tool_name": data.tool_name,
                    "arguments_raw": data.arguments_raw,
                },
            )


@internal_sio.on("rubric_progress")  # type: ignore
async def rubric_progress_internal(data: dict[str, Any]) -> None:
    """Handle rubric_progress event from internal bus."""
    # Only handle tool-related types
    if data.get("type") in ("tool_call_start", "tool_call_progress"):
        await handle_internal_event(
            data=data,
            request_type=RubricProgressPayload,
            handler=_rubric_progress_impl,  # type: ignore[arg-type]
            error_event_name="rubric_progress_error",
            error_response_type=RubricProgressErrorPayload,
        )


register_server_endpoint(
    server_router,
    "/rubric_progress",
    RubricProgressPayload,
    "Dispatch rubric progress to tool-specific handlers",
)
