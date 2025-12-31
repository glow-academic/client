"""Handler for image_error WebSocket event - ONE EVENT PER FILE."""

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


class ImageGenerationErrorApiRequest(BaseModel):
    """Request indicating an error occurred during image generation."""

    image_id: str
    error_message: str


class ImageGenerationErrorSqlRow(BaseModel):
    """Response indicating an error occurred in image generation."""

    success: bool
    image_id: str
    message: str


async def _image_error_impl(
    sid: str,
    data: ImageGenerationErrorApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "images_generation_error",
        ImageGenerationErrorSqlRow(
            success=False,
            image_id=data.image_id,
            message=data.error_message,
        ),
        room=sid,
    )


@internal_sio.on("image_error")  # type: ignore
async def image_error_internal(data: dict[str, Any]) -> None:
    """Handle image_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=ImageGenerationErrorApiRequest,
        handler=_image_error_impl,  # type: ignore[arg-type]
        error_event_name="images_generation_error",
        error_response_type=ImageGenerationErrorSqlRow,
    )


register_server_endpoint(
    server_router,
    "/generation_error",
    ImageGenerationErrorSqlRow,
    "Error occurred during image generation",
)
