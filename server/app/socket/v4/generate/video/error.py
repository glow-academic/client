"""Handler for generate_video_error WebSocket event - ONE EVENT PER FILE."""

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


class VideoErrorPayload(BaseModel):
    """Response indicating an error occurred in video generation."""

    success: bool
    message: str
    video_id: str | None = None


async def _generate_video_error_impl(
    sid: str,
    data: VideoErrorPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "videos_generation_error",
        data,
        room=sid,
    )


@internal_sio.on("generate_video_error")  # type: ignore
async def generate_video_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle generate_video_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=VideoErrorPayload,
        handler=_generate_video_error_impl,  # type: ignore[arg-type]
        error_event_name="videos_generation_error",
        error_response_type=VideoErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/generate_video_error",
    VideoErrorPayload,
    "Error occurred in video generation",
)
