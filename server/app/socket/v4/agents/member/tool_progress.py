"""Handler for member_progress WebSocket event - dispatches to tool-specific handlers."""

import uuid
from typing import Any

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio
from fastapi import APIRouter
from pydantic import BaseModel

internal_sio = get_internal_sio()

server_router = APIRouter()


class MemberProgressPayload(BaseModel):
    """Generic member progress event - dispatches to tool-specific handlers."""

    sid: str
    type: str  # "tool_call_start" | "tool_call_progress"
    chat_id: str
    run_id: str
    tool_name: str
    tool_call_id: str
    call_id: str | None = None
    token: str | None = None
    accumulated_content: str | None = None
    arguments_raw: str
    parent_message_id: str | None = None


class MemberProgressErrorPayload(BaseModel):
    """Error response for member progress."""

    success: bool
    message: str


async def _member_progress_impl(
    sid: str,
    data: MemberProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Dispatch to tool-specific progress handler."""
    # Route to appropriate tool handler based on tool_name (only speak for member agent)
    if data.type == "tool_call_start":
        # Emit tool-specific start event
        if data.tool_name == "speak":
            await internal_sio.emit(
                "member_speak_progress",
                {
                    "sid": data.sid,
                    "type": "tool_call_start",
                    "chat_id": data.chat_id,
                    "run_id": data.run_id,
                    "tool_call_id": data.tool_call_id,
                    "call_id": data.call_id,
                    "arguments_raw": data.arguments_raw,
                },
            )

    elif data.type == "tool_call_progress":
        # Emit tool-specific progress event
        if data.tool_name == "speak":
            await internal_sio.emit(
                "member_speak_progress",
                {
                    "sid": data.sid,
                    "type": "tool_call_progress",
                    "chat_id": data.chat_id,
                    "run_id": data.run_id,
                    "tool_call_id": data.tool_call_id,
                    "call_id": data.call_id,
                    "token": data.token,
                    "accumulated_content": data.accumulated_content,
                    "arguments_raw": data.arguments_raw,
                    "parent_message_id": data.parent_message_id,
                },
            )


@internal_sio.on("member_progress")  # type: ignore
async def member_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle member_progress event from internal bus."""
    # Only handle tool-related types - user message upserts handled by member/progress.py
    if data.get("type") in ("tool_call_start", "tool_call_progress"):
        await handle_internal_event(
            data=data,
            request_type=MemberProgressPayload,
            handler=_member_progress_impl,
            error_event_name="member_progress_error",
            error_response_type=MemberProgressErrorPayload,
        )


register_server_endpoint(
    server_router,
    "/member_progress",
    MemberProgressPayload,
    "Dispatch member progress to tool-specific handlers",
)
