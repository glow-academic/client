"""Handler for generate_text_error WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio
from fastapi import APIRouter
from pydantic import BaseModel

internal_sio = get_internal_sio()
server_router = APIRouter()


class TextErrorPayload(BaseModel):
    """Response indicating an error occurred in text generation."""

    success: bool
    message: str


async def _generate_text_error_impl(
    sid: str,
    data: TextErrorPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "text_generation_error",
        data,
        room=sid,
    )


@internal_sio.on("generate_text_error")  # type: ignore
async def generate_text_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle generate_text_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=TextErrorPayload,
        handler=_generate_text_error_impl,  # type: ignore[arg-type]
        error_event_name="text_generation_error",
        error_response_type=TextErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/generate_text_error",
    TextErrorPayload,
    "Error occurred in text generation",
)

