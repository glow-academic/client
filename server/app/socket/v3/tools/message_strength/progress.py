"""Handler for message_strength_progress WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio
from fastapi import APIRouter
from pydantic import BaseModel

internal_sio = get_internal_sio()
server_router = APIRouter()


class MessageStrengthProgressPayload(BaseModel):
    """Response indicating progress in Message Strength tool."""

    type: str
    message: str | None = None


class MessageStrengthErrorPayload(BaseModel):
    """Response indicating an error occurred in Message Strength tool."""

    success: bool
    message: str


async def _message_strength_progress_impl(
    sid: str,
    data: MessageStrengthProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "grading_tools_message_strength_progress",
        data,
        room=sid,
    )


@internal_sio.on("message_strength_progress")  # type: ignore
async def message_strength_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle message_strength_progress event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=MessageStrengthProgressPayload,
        handler=_message_strength_progress_impl,  # type: ignore[arg-type]
        error_event_name="grading_tools_message_strength_error",
        error_response_type=MessageStrengthErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/message_strength_progress",
    MessageStrengthProgressPayload,
    "Progress update for Message Strength tool",
)
