"""Handler for generate_video_start WebSocket event - client listener that receives frontend info."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_client_event
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class GenerateVideoStartPayload(BaseModel):
    """Request to start video generation - receives frontend info."""

    videoId: str
    prompt: str
    imageReferenceId: str | None = None


async def _generate_video_start_impl(
    sid: str,
    data: GenerateVideoStartPayload,
    profile_id: uuid.UUID,
) -> None:
    """Client listener - validates payload and emits internal event to trigger call.py."""
    # Validate payload and emit internal event to trigger call.py
    # Does NOT emit to client (that's handled by call.py/progress.py/complete.py)
    await emit_to_internal(
        "generate_video",
        {
            "sid": sid,
            "videoId": data.videoId,
            "prompt": data.prompt,
            "imageReferenceId": data.imageReferenceId,
        },
        sid=sid,
    )


@sio.event  # type: ignore
async def generate_video_start(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""
    # Server always expects snake_case - frontend must convert camelCase before sending
    await handle_client_event(
        sid=sid,
        data=data,
        request_type=GenerateVideoStartPayload,
        handler=_generate_video_start_impl,  # type: ignore[arg-type]
        error_event_name="videos_generation_error",
        error_response_type=None,
    )


register_client_endpoint(
    client_router,
    "/generate_video_start",
    GenerateVideoStartPayload,
    "Start video generation - receives frontend info",
)
