"""Handler for generate_video_complete WebSocket event - finalizes video generation."""

import uuid
from typing import Any

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio
from fastapi import APIRouter
from pydantic import BaseModel
from utils.cache.invalidate_tags import invalidate_tags

internal_sio = get_internal_sio()

server_router = APIRouter()


class VideoGenerationCompletePayload(BaseModel):
    """Response indicating video generation completed successfully."""

    success: bool
    message: str
    videoUrl: str | None = None
    videoId: str | None = None


async def _generate_video_complete_impl(
    sid: str,
    data: VideoGenerationCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle video generation completion - finalizes and emits to client."""
    # Invalidate cache
    await invalidate_tags(["videos"])

    # Emit to client
    await emit_to_client(
        "videos_generation_complete",
        data,
        room=sid,
    )


@internal_sio.on("generate_video_complete")  # type: ignore
async def generate_video_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle generate_video_complete event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=VideoGenerationCompletePayload,
        handler=_generate_video_complete_impl,  # type: ignore[arg-type]
        error_event_name="generate_video_error",
        error_response_type=None,
    )


register_server_endpoint(
    server_router,
    "/generate_video_complete",
    VideoGenerationCompletePayload,
    "Video generation completed successfully",
)
