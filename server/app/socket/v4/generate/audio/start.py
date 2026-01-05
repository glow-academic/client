"""Handler for generate_audio_start WebSocket event - client listener that receives frontend info and returns session info."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_client_event
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client, emit_to_internal
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class GenerateAudioStartPayload(BaseModel):
    """Request to start audio generation session - receives frontend info."""

    uploadId: str  # Input audio upload_id (optional - can be None for text-to-audio)
    prompt: str  # Text prompt for audio generation
    agentId: str  # Audio agent ID
    departmentId: str | None = None  # Optional department ID


class AudioSessionStartedPayload(BaseModel):
    """Response indicating audio session started - one-time response, not an event stream."""

    success: bool
    session_id: str | None
    job_id: str | None
    upload_id: str | None
    run_id: str | None
    message: str


async def _generate_audio_start_impl(
    sid: str,
    data: GenerateAudioStartPayload,
    profile_id: uuid.UUID,
) -> None:
    """Client listener - validates payload, emits internal event, and returns session info."""
    # Emit internal event to trigger call.py
    await emit_to_internal(
        "generate_audio",
        {
            "sid": sid,
            "uploadId": data.uploadId,
            "prompt": data.prompt,
            "agentId": data.agentId,
            "departmentId": data.departmentId,
        },
        sid=sid,
    )

    # Listen for session started response from call.py
    # This is a one-time response, not an event stream
    # Note: In practice, call.py will emit generate_audio_started which we handle below


@internal_sio.on("generate_audio_started")  # type: ignore
async def generate_audio_started_internal(data: dict[str, Any]) -> None:
    """Handle generate_audio_started event from call.py - returns session info to client."""
    sid = data.get("sid", "")
    if not sid:
        return

    # Return session info to frontend (NOT via events, via one-time WebSocket message)
    # NO event dispatch - just returns information
    await sio.emit(
        "audio_session_started",  # One-time response, not an event stream
        {
            "success": data.get("success", True),
            "session_id": data.get("session_id"),
            "job_id": data.get("job_id"),
            "upload_id": data.get("upload_id"),
            "run_id": data.get("run_id"),
            "message": data.get("message", "Audio generation session started"),
        },
        room=sid,
    )


@sio.event  # type: ignore
async def generate_audio_start(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""
    # Server always expects snake_case - frontend must convert camelCase before sending
    await handle_client_event(
        sid=sid,
        data=data,
        request_type=GenerateAudioStartPayload,
        handler=_generate_audio_start_impl,  # type: ignore[arg-type]
        error_event_name="audio_generation_error",
        error_response_type=None,
    )


register_client_endpoint(
    client_router,
    "/generate_audio_start",
    GenerateAudioStartPayload,
    "Start audio generation session - receives frontend info and returns session info",
)
