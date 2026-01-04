"""Handler for member_regenerate_tool WebSocket event - ONE EVENT PER FILE."""

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


class MemberRegenerateToolCallApiRequest(BaseModel):
    """Request for member regenerate tool call."""

    instructions: str | None = None


class MemberRegenerateToolCompleteApiRequest(BaseModel):
    """Response indicating member regenerate tool completed successfully."""

    success: bool
    message: str | None = None


class MemberRegenerateToolErrorSqlRow(BaseModel):
    """Response indicating an error occurred in member regenerate tool."""

    success: bool
    message: str


async def _member_regenerate_tool_call_impl(
    sid: str,
    data: MemberRegenerateToolCallApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation for member regenerate tool call."""
    # No-op for now - SQL files not yet created
    # Emit to internal complete event (will be handled by complete.py)
    await emit_to_internal(
        "member_regenerate_complete",
        MemberRegenerateToolCompleteApiRequest(
            success=True,
            message="Member regenerate processed successfully",
        ),
        sid=sid,
        group_id=str(group_id) if group_id else None,
    )


@internal_sio.on("member_regenerate_tool")  # type: ignore
async def member_regenerate_tool_internal(
    data: dict[str, Any],
) -> None:
    """Handle member_regenerate_tool event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=MemberRegenerateToolCallApiRequest,
        handler=_member_regenerate_tool_call_impl,  # type: ignore[arg-type]
        error_event_name="member_regenerate_error",
        error_response_type=MemberRegenerateToolErrorSqlRow,
    )


register_server_endpoint(
    server_router,
    "/member_regenerate_tool",
    MemberRegenerateToolCallApiRequest,
    "Member regenerate tool handler",
)

