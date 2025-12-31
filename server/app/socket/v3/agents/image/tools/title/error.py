"""Handler for image_tool_title_error WebSocket event - ONE EVENT PER FILE."""

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


class ImageTitleErrorPayload(BaseModel):
    """Response indicating an error occurred in title tool."""

    success: bool
    message: str
    trace_id: str


async def _image_tool_title_error_impl(
    sid: str,
    data: ImageTitleErrorPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    # Image Title tool already emits directly in call.py, so this is a no-op forwarder
    await emit_to_client(
        "image_tool_title_error",
        data,
        room=sid,
    )


@internal_sio.on("image_tool_title_error")  # type: ignore
async def title_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle image_tool_title_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=ImageTitleErrorPayload,
        handler=_image_tool_title_error_impl,  # type: ignore[arg-type]
        error_event_name="image_tool_title_error",
        error_response_type=ImageTitleErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/image_tool_title_error",
    ImageTitleErrorPayload,
    "Error occurred in Image Title tool",
)
