"""Handler for generate_image_progress WebSocket event - handles progress updates (if dispatched)."""

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


class ImageGenerationProgressPayload(BaseModel):
    """Request indicating progress in image generation."""

    sid: str
    image_id: str
    progress_type: str
    message: str | None = None


async def _generate_image_progress_impl(
    sid: str,
    data: ImageGenerationProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle progress - forwards to client if received."""
    # Most image providers don't provide progress updates, so this may rarely be called
    # Minimal logic - mainly routing
    await emit_to_client(
        "images_generation_progress",
        {
            "type": data.progress_type,
            "message": data.message,
            "image_id": data.image_id,
        },
        room=sid,
    )


@internal_sio.on("generate_image_progress")  # type: ignore
async def generate_image_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle generate_image_progress event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=ImageGenerationProgressPayload,
        handler=_generate_image_progress_impl,  # type: ignore[arg-type]
        error_event_name="generate_image_error",
        error_response_type=None,
    )


register_server_endpoint(
    server_router,
    "/generate_image_progress",
    ImageGenerationProgressPayload,
    "Progress update for image generation (rarely used)",
)
