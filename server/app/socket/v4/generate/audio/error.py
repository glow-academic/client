"""Handler for generate_audio_error WebSocket event - handles errors during session start."""

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


class AudioErrorPayload(BaseModel):
    """Response indicating an error occurred in audio generation."""

    success: bool
    message: str
    upload_id: str | None = None


async def _generate_audio_error_impl(
    sid: str,
    data: AudioErrorPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    # Standard error forwarding (only for session start errors)
    await emit_to_client(
        "audio_generation_error",
        data,
        room=sid,
    )


@internal_sio.on("generate_audio_error")  # type: ignore
async def generate_audio_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle generate_audio_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=AudioErrorPayload,
        handler=_generate_audio_error_impl,  # type: ignore[arg-type]
        error_event_name="audio_generation_error",
        error_response_type=AudioErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/generate_audio_error",
    AudioErrorPayload,
    "Error occurred in audio generation (session start only)",
)
