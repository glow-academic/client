"""Handler for prompt_complete WebSocket event - dispatches to tool-specific handlers and tracks overall completion."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class PromptCompletePayload(BaseModel):
    """Generic prompt complete event - dispatches to tool-specific handlers."""

    sid: str
    type: str  # "tool_call_complete" | "run_complete"
    chat_id: str
    run_id: str
    tool_name: str | None = None
    tool_call_id: str | None = None
    call_id: str | None = None
    final_content: str | None = None
    arguments_raw: str | None = None


class PromptCompleteErrorPayload(BaseModel):
    """Error response for prompt complete."""

    success: bool
    message: str


async def _prompt_complete_impl(
    sid: str,
    data: PromptCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Dispatch to tool-specific complete handler."""
    if data.type == "tool_call_complete":
        # Route to appropriate tool handler
        if data.tool_name == "instruct":
            await internal_sio.emit(
                "prompt_instruct_complete",
                {
                    "sid": data.sid,
                    "chat_id": data.chat_id,
                    "run_id": data.run_id,
                    "tool_call_id": data.tool_call_id,
                    "call_id": data.call_id,
                    "final_content": data.final_content,
                    "arguments_raw": data.arguments_raw,
                },
            )
        elif data.tool_name == "prompt":
            await internal_sio.emit(
                "prompt_prompt_complete",
                {
                    "sid": data.sid,
                    "chat_id": data.chat_id,
                    "run_id": data.run_id,
                    "tool_call_id": data.tool_call_id,
                    "call_id": data.call_id,
                    "final_content": data.final_content,
                    "arguments_raw": data.arguments_raw,
                },
            )

    elif data.type == "run_complete":
        # All tools done - emit overall completion
        await emit_to_client(
            "prompt_generate_complete",
            {
                "success": True,
                "chat_id": data.chat_id,
                "run_id": data.run_id,
            },
            room=sid,
        )


@internal_sio.on("prompt_complete")  # type: ignore
async def prompt_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle prompt_complete event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=PromptCompletePayload,
        handler=_prompt_complete_impl,  # type: ignore[arg-type]
        error_event_name="prompt_complete_error",
        error_response_type=PromptCompleteErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/prompt_complete",
    PromptCompletePayload,
    "Dispatch prompt complete to tool-specific handlers",
)
