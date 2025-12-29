"""Handler for video_complete WebSocket event - ONE EVENT PER FILE."""

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


class VideoCompletePayload(BaseModel):
    """Response indicating Video tool completed successfully."""

    success: bool
    message: str | None = None


class VideoErrorPayload(BaseModel):
    """Response indicating an error occurred in Video tool."""

    success: bool
    message: str


async def _video_complete_impl(
    sid: str,
    data: VideoCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "scenarios_tools_video_complete",
        data,
        room=sid,
    )


@internal_sio.on("video_complete")  # type: ignore
async def video_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle video_complete event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=VideoCompletePayload,
        handler=_video_complete_impl,  # type: ignore[arg-type]
        error_event_name="scenarios_tools_video_error",
        error_response_type=VideoErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/video_complete",
    VideoCompletePayload,
    "Video tool completed successfully",
)
