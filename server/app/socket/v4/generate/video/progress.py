"""Handler for generate_video_progress WebSocket event - handles polling progress updates."""

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


class VideoGenerationProgressPayload(BaseModel):
    """Response indicating progress in video generation."""

    sid: str
    type: str  # "start", "polling", "completed"
    message: str | None = None
    status: str | None = None  # "created", "processing", "completed", "failed"
    progress: float | None = None  # 0.0 to 1.0
    video_id: str | None = None


async def _generate_video_progress_impl(
    sid: str,
    data: VideoGenerationProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle progress - forwards polling updates to client."""
    # Receives polling updates from call.py
    # Forwards to client as videos_generation_progress
    await emit_to_client(
        "videos_generation_progress",
        {
            "type": data.type,
            "message": data.message,
            "status": data.status,
            "progress": data.progress,
            "video_id": data.video_id,
        },
        room=sid,
    )


@internal_sio.on("generate_video_progress")  # type: ignore
async def generate_video_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle generate_video_progress event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=VideoGenerationProgressPayload,
        handler=_generate_video_progress_impl,  # type: ignore[arg-type]
        error_event_name="generate_video_error",
        error_response_type=None,
    )


register_server_endpoint(
    server_router,
    "/generate_video_progress",
    VideoGenerationProgressPayload,
    "Progress update for video generation (polling-based)",
)
