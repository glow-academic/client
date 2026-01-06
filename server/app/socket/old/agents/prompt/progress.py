"""Handler for prompt_progress WebSocket event - dispatches to tool-specific handlers."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio

internal_sio = get_internal_sio()

server_router = APIRouter()


class PromptProgressPayload(BaseModel):
    """Generic prompt progress event - dispatches to tool-specific handlers."""

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


class PromptProgressErrorPayload(BaseModel):
    """Error response for prompt progress."""

    success: bool
    message: str


async def _prompt_progress_impl(
    sid: str,
    data: PromptProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Dispatch to tool-specific progress handler."""
    # Route to appropriate tool handler based on tool_name
    if data.type == "tool_call_start":
        # Emit tool-specific start event
        if data.tool_name == "create_developer_instruction":
            await internal_sio.emit(
                "prompt_instruct_progress",
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
        elif data.tool_name == "create_prompt":
            await internal_sio.emit(
                "prompt_prompt_progress",
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
        if data.tool_name == "create_developer_instruction":
            await internal_sio.emit(
                "prompt_instruct_progress",
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
        elif data.tool_name == "create_prompt":
            await internal_sio.emit(
                "prompt_prompt_progress",
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


@internal_sio.on("prompt_progress")  # type: ignore
async def prompt_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle prompt_progress event from internal bus."""
    # Only handle tool-related types
    if data.get("type") in ("tool_call_start", "tool_call_progress"):
        await handle_internal_event(
            data=data,
            request_type=PromptProgressPayload,
            handler=_prompt_progress_impl,
            error_event_name="prompt_progress_error",
            error_response_type=PromptProgressErrorPayload,
        )


register_server_endpoint(
    server_router,
    "/prompt_progress",
    PromptProgressPayload,
    "Dispatch prompt progress to tool-specific handlers",
)
