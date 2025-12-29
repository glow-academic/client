"""Handler for video_progress WebSocket event - ONE EVENT PER FILE."""

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


class VideoProgressPayload(BaseModel):
    """Response indicating progress in Video tool."""

    type: str
    message: str | None = None


class VideoErrorPayload(BaseModel):
    """Response indicating an error occurred in Video tool."""

    success: bool
    message: str


async def _video_progress_impl(
    sid: str,
    data: VideoProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "scenarios_tools_video_progress",
        data,
        room=sid,
    )


@internal_sio.on("video_progress")  # type: ignore
async def video_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle video_progress event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=VideoProgressPayload,
        handler=_video_progress_impl,  # type: ignore[arg-type]
        error_event_name="scenarios_tools_video_error",
        error_response_type=VideoErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/video_progress",
    VideoProgressPayload,
    "Progress update for Video tool",
)
