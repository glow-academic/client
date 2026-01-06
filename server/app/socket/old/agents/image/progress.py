"""Handler for image_progress WebSocket event - ONE EVENT PER FILE."""

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


class ImageGenerationProgressApiRequest(BaseModel):
    """Request indicating progress in image generation."""

    image_id: str
    progress_type: str
    message: str | None = None


class ImageGenerationProgressSqlRow(BaseModel):
    """Response indicating progress in image generation."""

    type: str
    message: str | None = None
    image_id: str


class ImageGenerationErrorSqlRow(BaseModel):
    """Response indicating an error occurred in image generation."""

    success: bool
    image_id: str
    message: str


async def _image_progress_impl(
    sid: str,
    data: ImageGenerationProgressApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "images_generation_progress",
        ImageGenerationProgressSqlRow(
            type=data.progress_type,
            message=data.message,
            image_id=data.image_id,
        ),
        room=sid,
    )


@internal_sio.on("image_progress")  # type: ignore
async def image_progress_internal(data: dict[str, Any]) -> None:
    """Handle image_progress event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=ImageGenerationProgressApiRequest,
        handler=_image_progress_impl,  # type: ignore[arg-type]
        error_event_name="images_generation_error",
        error_response_type=ImageGenerationErrorSqlRow,
    )


register_server_endpoint(
    server_router,
    "/generation_progress",
    ImageGenerationProgressSqlRow,
    "Progress update for image generation",
)
