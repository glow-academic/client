"""Handler for image_complete WebSocket event - ONE EVENT PER FILE."""

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


class ImageCompletePayload(BaseModel):
    """Response indicating Image tool completed successfully."""

    success: bool
    message: str | None = None


class ImageErrorPayload(BaseModel):
    """Response indicating an error occurred in Image tool."""

    success: bool
    message: str


async def _image_complete_impl(
    sid: str,
    data: ImageCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "scenarios_tools_image_complete",
        data,
        room=sid,
    )


@internal_sio.on("image_complete")  # type: ignore
async def image_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle image_complete event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=ImageCompletePayload,
        handler=_image_complete_impl,  # type: ignore[arg-type]
        error_event_name="scenarios_tools_image_error",
        error_response_type=ImageErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/image_complete",
    ImageCompletePayload,
    "Image tool completed successfully",
)
