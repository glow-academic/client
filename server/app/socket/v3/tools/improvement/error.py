"""Handler for message_improvement_error WebSocket event - ONE EVENT PER FILE."""

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


class MessageImprovementErrorPayload(BaseModel):
    """Response indicating an error occurred in Message Improvement tool."""

    success: bool
    message: str


async def _message_improvement_error_impl(
    sid: str,
    data: MessageImprovementErrorPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "grading_tools_message_improvement_error",
        data,
        room=sid,
    )


@internal_sio.on("message_improvement_error")  # type: ignore
async def message_improvement_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle message_improvement_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=MessageImprovementErrorPayload,
        handler=_message_improvement_error_impl,  # type: ignore[arg-type]
        error_event_name="grading_tools_message_improvement_error",
        error_response_type=MessageImprovementErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/message_improvement_error",
    MessageImprovementErrorPayload,
    "Error occurred in Message Improvement tool",
)
