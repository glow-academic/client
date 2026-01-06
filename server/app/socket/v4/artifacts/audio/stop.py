"""Unified audio session stop endpoint."""

from typing import Any

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest
from fastapi import APIRouter
from pydantic import BaseModel

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class AudioSessionStopApiRequest(BaseModel):
    """Payload for audio session stop."""

    run_id: str
    resource_id: str | None = None
    resource_type: str | None = None


async def _audio_session_stop_impl(
    sid: str,
    data: AudioSessionStopApiRequest,
    profile_id: Any,
) -> None:
    """Handle audio session stop - cleanup and emit stop event.

    Args:
        sid: Socket ID
        data: Stop request payload
        profile_id: Profile ID (unused but required by handler wrapper)
    """
    try:
        # Emit stop event to frontend
        await internal_sio.emit(
            "audio_session_stopped",
            {
                "sid": sid,
                "success": True,
                "run_id": data.run_id,
                "resource_id": data.resource_id,
                "resource_type": data.resource_type,
                "message": "Audio session stopped successfully",
            },
        )

    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to stop audio session: {str(e)}",
                resource_id=data.resource_id,
                resource_type=data.resource_type,
            ),
            sid=sid,
        )


@internal_sio.on("audio_session_stop")  # type: ignore
async def audio_session_stop_internal(data: dict[str, Any]) -> None:
    """Handle audio_session_stop event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=AudioSessionStopApiRequest,
        handler=_audio_session_stop_impl,  # type: ignore[arg-type]
        error_event_name="generate_error",
        error_response_type=GenerateErrorApiRequest,
    )


register_server_endpoint(
    server_router,
    "/audio/stop",
    AudioSessionStopApiRequest,
    "Stop audio generation session",
)

