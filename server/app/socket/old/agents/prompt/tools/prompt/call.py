"""Handler for prompt_prompt_tool WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio

internal_sio = get_internal_sio()
server_router = APIRouter()


class PromptPromptToolCallApiRequest(BaseModel):
    """Request for prompt prompt tool call."""

    sid: str
    chat_id: str
    run_id: str
    call_id: str | None = None
    tool_call_id: str
    content: str | None = None
    arguments_raw: str


class PromptPromptToolCompleteApiRequest(BaseModel):
    """Response indicating prompt prompt tool completed successfully."""

    sid: str
    chat_id: str
    run_id: str
    tool_call_id: str
    call_id: str | None = None
    final_content: str
    arguments_raw: str


class PromptPromptToolErrorSqlRow(BaseModel):
    """Response indicating an error occurred in prompt prompt tool."""

    success: bool
    message: str


async def _prompt_prompt_tool_call_impl(
    sid: str,
    data: PromptPromptToolCallApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation for prompt prompt tool call."""
    # No-op for now - SQL files not yet created
    # Emit to internal complete event (will be handled by complete.py)
    await emit_to_internal(
        "prompt_prompt_complete",
        PromptPromptToolCompleteApiRequest(
            success=True,
            message="Prompt prompt processed successfully",
        ),
        sid=sid,
        group_id=str(group_id) if group_id else None,
    )


@internal_sio.on("prompt_prompt_tool")  # type: ignore
async def prompt_prompt_tool_internal(
    data: dict[str, Any],
) -> None:
    """Handle prompt_prompt_tool event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=PromptPromptToolCallApiRequest,
        handler=_prompt_prompt_tool_call_impl,  # type: ignore[arg-type]
        error_event_name="prompt_prompt_error",
        error_response_type=PromptPromptToolErrorSqlRow,
    )


register_server_endpoint(
    server_router,
    "/prompt_prompt_tool",
    PromptPromptToolCallApiRequest,
    "Prompt prompt tool handler",
)
