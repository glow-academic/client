"""Handler for speak_tool WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio

internal_sio = get_internal_sio()
server_router = APIRouter()


class SpeakToolCallApiRequest(BaseModel):
    """Request for speak tool call."""

    message: str | None = None


class SpeakToolCompleteApiRequest(BaseModel):
    """Response indicating speak tool completed successfully."""

    success: bool
    message: str | None = None


class SpeakToolErrorSqlRow(BaseModel):
    """Response indicating an error occurred in speak tool."""

    success: bool
    message: str


async def _speak_tool_call_impl(
    sid: str,
    data: SpeakToolCallApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation for speak tool call."""
    # No-op for now - SQL files not yet created
    # Emit to internal complete event (will be handled by complete.py)
    await emit_to_internal(
        "speak_complete",
        SpeakToolCompleteApiRequest(
            success=True,
            message="Speak processed successfully",
        ),
        sid=sid,
        group_id=str(group_id) if group_id else None,
    )


@internal_sio.on("speak_tool")  # type: ignore
async def speak_tool_internal(
    data: dict[str, Any],
) -> None:
    """Handle speak_tool event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=SpeakToolCallApiRequest,
        handler=_speak_tool_call_impl,  # type: ignore[arg-type]
        error_event_name="speak_error",
        error_response_type=SpeakToolErrorSqlRow,
    )


register_server_endpoint(
    server_router,
    "/speak_tool",
    SpeakToolCallApiRequest,
    "Speak tool handler",
)
