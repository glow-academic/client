"""Handler for hint_progress WebSocket event - dispatches to tool-specific handlers."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio

internal_sio = get_internal_sio()

server_router = APIRouter()


class HintProgressPayload(BaseModel):
    """Generic hint progress event - dispatches to tool-specific handlers."""

    sid: str
    type: str  # "tool_call_start" | "tool_call_progress"
    chat_id: str
    message_id: str
    run_id: str
    tool_name: str
    tool_call_id: str
    call_id: str | None = None
    arguments_raw: str


class HintProgressErrorPayload(BaseModel):
    """Error response for hint progress."""

    success: bool
    message: str


async def _hint_progress_impl(
    sid: str,
    data: HintProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Dispatch to tool-specific progress handler."""
    # Route to appropriate tool handler based on tool_name
    if data.type == "tool_call_start":
        # Emit tool-specific start event
        if data.tool_name == "create_hint":
            await internal_sio.emit(
                "hint_hint_progress",
                {
                    "sid": data.sid,
                    "type": "tool_call_start",
                    "chat_id": data.chat_id,
                    "message_id": data.message_id,
                    "run_id": data.run_id,
                    "tool_call_id": data.tool_call_id,
                    "call_id": data.call_id,
                    "tool_name": data.tool_name,
                    "arguments_raw": data.arguments_raw,
                },
            )

    elif data.type == "tool_call_progress":
        # Emit tool-specific progress event
        if data.tool_name == "create_hint":
            await internal_sio.emit(
                "hint_hint_progress",
                {
                    "sid": data.sid,
                    "type": "tool_call_progress",
                    "chat_id": data.chat_id,
                    "message_id": data.message_id,
                    "run_id": data.run_id,
                    "tool_call_id": data.tool_call_id,
                    "call_id": data.call_id,
                    "tool_name": data.tool_name,
                    "arguments_raw": data.arguments_raw,
                },
            )


@internal_sio.on("hint_progress")  # type: ignore
async def hint_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle hint_progress event from internal bus."""
    # Only handle tool-related types
    if data.get("type") in ("tool_call_start", "tool_call_progress"):
        await handle_internal_event(
            data=data,
            request_type=HintProgressPayload,
            handler=_hint_progress_impl,  # type: ignore[arg-type]
            error_event_name="hint_progress_error",
            error_response_type=HintProgressErrorPayload,
        )


register_server_endpoint(
    server_router,
    "/hint_progress",
    HintProgressPayload,
    "Dispatch hint progress to tool-specific handlers",
)
