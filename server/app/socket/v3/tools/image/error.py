"""Handler for image_error WebSocket event - ONE EVENT PER FILE."""

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


class ImageErrorPayload(BaseModel):
    """Response indicating an error occurred in Image tool."""

    success: bool
    message: str


async def _image_error_impl(
    sid: str,
    data: ImageErrorPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "scenarios_tools_image_error",
        data,
        room=sid,
    )


@internal_sio.on("image_error")  # type: ignore
async def image_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle image_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=ImageErrorPayload,
        handler=_image_error_impl,  # type: ignore[arg-type]
        error_event_name="scenarios_tools_image_error",
        error_response_type=ImageErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/image_error",
    ImageErrorPayload,
    "Error occurred in Image tool",
)
