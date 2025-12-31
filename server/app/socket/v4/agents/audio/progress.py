"""Handler for audio_progress WebSocket event - ONE EVENT PER FILE."""

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


class AudioProgressPayload(BaseModel):
    """Response indicating progress in Audio grading generation."""

    type: str
    message: str | None = None


class AudioErrorPayload(BaseModel):
    """Response indicating an error occurred in Audio grading generation."""

    success: bool
    message: str


async def _audio_progress_impl(
    sid: str,
    data: AudioProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "simulations_voice_grading_progress",
        data,
        room=sid,
    )


@internal_sio.on("audio_progress")  # type: ignore
async def audio_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle audio_progress event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=AudioProgressPayload,
        handler=_audio_progress_impl,  # type: ignore[arg-type]
        error_event_name="simulations_voice_grading_error",
        error_response_type=AudioErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/audio_progress",
    AudioProgressPayload,
    "Progress update for Audio grading generation",
)
