"""Handler for message_strength_complete WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio

internal_sio = get_internal_sio()
server_router = APIRouter()


class MessageStrengthCompletePayload(BaseModel):
    """Response indicating Message Strength tool completed successfully."""

    success: bool
    message: str | None = None


class MessageStrengthErrorPayload(BaseModel):
    """Response indicating an error occurred in Message Strength tool."""

    success: bool
    message: str


async def _message_strength_complete_impl(
    sid: str,
    data: MessageStrengthCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "grading_tools_message_strength_complete",
        data,
        room=sid,
    )


@internal_sio.on("message_strength_complete")  # type: ignore
async def message_strength_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle message_strength_complete event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=MessageStrengthCompletePayload,
        handler=_message_strength_complete_impl,  # type: ignore[arg-type]
        error_event_name="grading_tools_message_strength_error",
        error_response_type=MessageStrengthErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/message_strength_complete",
    MessageStrengthCompletePayload,
    "Message Strength tool completed successfully",
)
