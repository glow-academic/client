"""Handler for audio_complete WebSocket event - ONE EVENT PER FILE."""

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


class AudioCompletePayload(BaseModel):
    """Response indicating Audio grading generation completed successfully."""

    success: bool
    message: str | None = None


class AudioErrorPayload(BaseModel):
    """Response indicating an error occurred in Audio grading generation."""

    success: bool
    message: str


async def _audio_complete_impl(
    sid: str,
    data: AudioCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "simulations_voice_grading_complete",
        data,
        room=sid,
    )


@internal_sio.on("audio_complete")  # type: ignore
async def audio_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle audio_complete event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=AudioCompletePayload,
        handler=_audio_complete_impl,  # type: ignore[arg-type]
        error_event_name="simulations_voice_grading_error",
        error_response_type=AudioErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/audio_complete",
    AudioCompletePayload,
    "Audio grading generation completed successfully",
)
