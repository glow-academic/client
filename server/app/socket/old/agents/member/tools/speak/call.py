"""Handler for member_speak_tool WebSocket event - ONE EVENT PER FILE."""

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


class MemberSpeakToolCallApiRequest(BaseModel):
    """Request for member speak tool call."""

    sid: str
    chat_id: str
    run_id: str
    call_id: str | None = None
    tool_call_id: str
    message: str | None = None
    arguments_raw: str


class MemberSpeakToolCompleteApiRequest(BaseModel):
    """Response indicating member speak tool completed successfully."""

    sid: str
    chat_id: str
    run_id: str
    tool_call_id: str
    call_id: str | None = None
    final_message: str
    arguments_raw: str


class MemberSpeakToolErrorSqlRow(BaseModel):
    """Response indicating an error occurred in member speak tool."""

    success: bool
    message: str


async def _member_speak_tool_call_impl(
    sid: str,
    data: MemberSpeakToolCallApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation for member speak tool call."""
    # No-op for now - SQL files not yet created
    # Emit to internal complete event (will be handled by complete.py)
    await emit_to_internal(
        "member_speak_complete",
        MemberSpeakToolCompleteApiRequest(
            success=True,
            message="Member speak processed successfully",
        ),
        sid=sid,
        group_id=str(group_id) if group_id else None,
    )


@internal_sio.on("member_speak_tool")  # type: ignore
async def member_speak_tool_internal(
    data: dict[str, Any],
) -> None:
    """Handle member_speak_tool event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=MemberSpeakToolCallApiRequest,
        handler=_member_speak_tool_call_impl,  # type: ignore[arg-type]
        error_event_name="member_speak_error",
        error_response_type=MemberSpeakToolErrorSqlRow,
    )


register_server_endpoint(
    server_router,
    "/member_speak_tool",
    MemberSpeakToolCallApiRequest,
    "Member speak tool handler",
)
