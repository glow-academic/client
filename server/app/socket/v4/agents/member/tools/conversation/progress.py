"""Handler for conversation_end_progress WebSocket event - ONE EVENT PER FILE."""

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


class ConversationEndProgressPayload(BaseModel):
    """Response indicating progress in ConversationEnd tool."""

    type: str
    message: str | None = None


class ConversationEndErrorPayload(BaseModel):
    """Response indicating an error occurred in ConversationEnd tool."""

    success: bool
    chat_id: str
    trace_id: str
    message: str


async def _conversation_end_progress_impl(
    sid: str,
    data: ConversationEndProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "conversation_end_progress",
        data,
        room=sid,
    )


@internal_sio.on("conversation_end_progress")  # type: ignore
async def conversation_end_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle conversation_end_progress event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=ConversationEndProgressPayload,
        handler=_conversation_end_progress_impl,  # type: ignore[arg-type]
        error_event_name="conversation_end_error",
        error_response_type=ConversationEndErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/conversation_end_progress",
    ConversationEndProgressPayload,
    "Progress update for ConversationEnd tool",
)
