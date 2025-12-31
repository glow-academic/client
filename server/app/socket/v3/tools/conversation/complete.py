"""Handler for conversation_end_complete WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio

internal_sio = get_internal_sio()
server_router = APIRouter()


class ConversationEndCompletePayload(BaseModel):
    """Response indicating ConversationEnd tool completed successfully."""

    success: bool
    chat_id: str
    trace_id: str
    message: str | None = None


class ConversationEndErrorPayload(BaseModel):
    """Response indicating an error occurred in ConversationEnd tool."""

    success: bool
    chat_id: str
    trace_id: str
    message: str


async def _conversation_end_complete_impl(
    sid: str,
    data: ConversationEndCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "conversation_end_complete",
        data,
        room=sid,
    )


@internal_sio.on("conversation_end_complete")  # type: ignore
async def conversation_end_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle conversation_end_complete event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=ConversationEndCompletePayload,
        handler=_conversation_end_complete_impl,  # type: ignore[arg-type]
        error_event_name="conversation_end_error",
        error_response_type=ConversationEndErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/conversation_end_complete",
    ConversationEndCompletePayload,
    "ConversationEnd tool completed successfully",
)

