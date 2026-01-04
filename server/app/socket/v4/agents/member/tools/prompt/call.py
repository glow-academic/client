"""Handler for member_prompt_tool WebSocket event - ONE EVENT PER FILE."""

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


class MemberPromptToolCallApiRequest(BaseModel):
    """Request for member prompt tool call."""

    content: str


class MemberPromptToolCompleteApiRequest(BaseModel):
    """Response indicating member prompt tool completed successfully."""

    success: bool
    message: str | None = None


class MemberPromptToolErrorSqlRow(BaseModel):
    """Response indicating an error occurred in member prompt tool."""

    success: bool
    message: str


async def _member_prompt_tool_call_impl(
    sid: str,
    data: MemberPromptToolCallApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation for member prompt tool call."""
    # No-op for now - SQL files not yet created
    # Emit to internal complete event (will be handled by complete.py)
    await emit_to_internal(
        "member_prompt_complete",
        MemberPromptToolCompleteApiRequest(
            success=True,
            message="Member prompt processed successfully",
        ),
        sid=sid,
        group_id=str(group_id) if group_id else None,
    )


@internal_sio.on("member_prompt_tool")  # type: ignore
async def member_prompt_tool_internal(
    data: dict[str, Any],
) -> None:
    """Handle member_prompt_tool event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=MemberPromptToolCallApiRequest,
        handler=_member_prompt_tool_call_impl,  # type: ignore[arg-type]
        error_event_name="member_prompt_error",
        error_response_type=MemberPromptToolErrorSqlRow,
    )


register_server_endpoint(
    server_router,
    "/member_prompt_tool",
    MemberPromptToolCallApiRequest,
    "Member prompt tool handler",
)

