"""WebRTC forwarding events handler - routes to adapter's handle_webrtc_event()."""

import uuid
from typing import Any

from app.infra.v4.websocket.find_profile_by_socket import \
    find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest
from fastapi import APIRouter
from pydantic import BaseModel

from .adapter import OpenAIAudioAdapter

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class AudioWebRTCEventApiRequest(BaseModel):
    """Payload for WebRTC forwarding events."""

    event_type: str  # audio_user_start, audio_assistant_progress, etc.
    event_data: dict[str, Any]  # Event-specific payload
    run_id: str


# Unified audio event types (14 events total)
AUDIO_EVENT_TYPES = {
    # User events
    "audio_user_start",
    "audio_user_progress",
    "audio_user_complete",
    # Assistant events
    "audio_assistant_start",
    "audio_assistant_progress",
    "audio_assistant_complete",
    # Tool call events
    "audio_tool_call_start",
    "audio_tool_call_progress",
    "audio_tool_call_complete",
    # Audio linking events
    "audio_user_audio_link",
    "audio_assistant_audio_link",
    # Session events
    "audio_session_usage",
    "audio_session_interrupt",
    # Error events
    "audio_error",
}


async def _audio_webrtc_event_impl(
    sid: str,
    data: AudioWebRTCEventApiRequest,
    profile_id: uuid.UUID,
) -> None:
    """Handle WebRTC forwarding events - routes to adapter's handle_webrtc_event().

    Args:
        sid: Socket ID
        data: Event payload with event_type, event_data, run_id
        profile_id: Profile ID
    """
    try:
        # Validate event type
        if data.event_type not in AUDIO_EVENT_TYPES:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Unknown audio event type: {data.event_type}",
                    resource_id=None,
                    resource_type="audio",
                ),
                sid=sid,
            )
            return

        async with get_db_connection() as conn:
            # Get adapter based on run_id (determine provider from run)
            # For now, default to OpenAI - can be enhanced to lookup provider from run
            adapter = OpenAIAudioAdapter()

            # Route to adapter's handle_webrtc_event()
            run_id_uuid = uuid.UUID(data.run_id)
            await adapter.handle_webrtc_event(
                conn=conn,
                event_type=data.event_type,
                event_data=data.event_data,
                run_id=run_id_uuid,
            )

            # Emit generic audio event for listeners (simulation layer, benchmarks, etc.)
            await emit_to_internal(
                data.event_type,
                {
                    "run_id": data.run_id,
                    "event_data": data.event_data,
                },
                sid=sid,
            )

    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to handle audio event: {str(e)}",
                resource_id=None,
                resource_type="audio",
            ),
            sid=sid,
        )


@internal_sio.on("audio_webrtc_event")  # type: ignore
async def audio_webrtc_event_internal(data: dict[str, Any]) -> None:
    """Handle audio_webrtc_event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=AudioWebRTCEventApiRequest,
        handler=_audio_webrtc_event_impl,  # type: ignore[arg-type]
        error_event_name="generate_error",
        error_response_type=GenerateErrorApiRequest,
    )


# Individual event handlers for backward compatibility
@internal_sio.on("audio_user_start")  # type: ignore
async def audio_user_start_internal(data: dict[str, Any]) -> None:
    """Handle audio_user_start event."""
    await _forward_to_webrtc_handler("audio_user_start", data)


@internal_sio.on("audio_user_progress")  # type: ignore
async def audio_user_progress_internal(data: dict[str, Any]) -> None:
    """Handle audio_user_progress event."""
    await _forward_to_webrtc_handler("audio_user_progress", data)


@internal_sio.on("audio_user_complete")  # type: ignore
async def audio_user_complete_internal(data: dict[str, Any]) -> None:
    """Handle audio_user_complete event."""
    await _forward_to_webrtc_handler("audio_user_complete", data)


@internal_sio.on("audio_assistant_start")  # type: ignore
async def audio_assistant_start_internal(data: dict[str, Any]) -> None:
    """Handle audio_assistant_start event."""
    await _forward_to_webrtc_handler("audio_assistant_start", data)


@internal_sio.on("audio_assistant_progress")  # type: ignore
async def audio_assistant_progress_internal(data: dict[str, Any]) -> None:
    """Handle audio_assistant_progress event."""
    await _forward_to_webrtc_handler("audio_assistant_progress", data)


@internal_sio.on("audio_assistant_complete")  # type: ignore
async def audio_assistant_complete_internal(data: dict[str, Any]) -> None:
    """Handle audio_assistant_complete event."""
    await _forward_to_webrtc_handler("audio_assistant_complete", data)


@internal_sio.on("audio_tool_call_start")  # type: ignore
async def audio_tool_call_start_internal(data: dict[str, Any]) -> None:
    """Handle audio_tool_call_start event."""
    await _forward_to_webrtc_handler("audio_tool_call_start", data)


@internal_sio.on("audio_tool_call_progress")  # type: ignore
async def audio_tool_call_progress_internal(data: dict[str, Any]) -> None:
    """Handle audio_tool_call_progress event."""
    await _forward_to_webrtc_handler("audio_tool_call_progress", data)


@internal_sio.on("audio_tool_call_complete")  # type: ignore
async def audio_tool_call_complete_internal(data: dict[str, Any]) -> None:
    """Handle audio_tool_call_complete event."""
    await _forward_to_webrtc_handler("audio_tool_call_complete", data)


@internal_sio.on("audio_user_audio_link")  # type: ignore
async def audio_user_audio_link_internal(data: dict[str, Any]) -> None:
    """Handle audio_user_audio_link event."""
    await _forward_to_webrtc_handler("audio_user_audio_link", data)


@internal_sio.on("audio_assistant_audio_link")  # type: ignore
async def audio_assistant_audio_link_internal(data: dict[str, Any]) -> None:
    """Handle audio_assistant_audio_link event."""
    await _forward_to_webrtc_handler("audio_assistant_audio_link", data)


@internal_sio.on("audio_session_usage")  # type: ignore
async def audio_session_usage_internal(data: dict[str, Any]) -> None:
    """Handle audio_session_usage event."""
    await _forward_to_webrtc_handler("audio_session_usage", data)


@internal_sio.on("audio_session_interrupt")  # type: ignore
async def audio_session_interrupt_internal(data: dict[str, Any]) -> None:
    """Handle audio_session_interrupt event."""
    await _forward_to_webrtc_handler("audio_session_interrupt", data)


@internal_sio.on("audio_error")  # type: ignore
async def audio_error_internal(data: dict[str, Any]) -> None:
    """Handle audio_error event."""
    await _forward_to_webrtc_handler("audio_error", data)


async def _forward_to_webrtc_handler(event_type: str, data: dict[str, Any]) -> None:
    """Forward individual event to unified webrtc handler."""
    run_id = data.get("run_id", "")
    if not run_id:
        return

    # Extract event-specific data (everything except run_id and sid)
    event_data = {k: v for k, v in data.items() if k not in ("run_id", "sid")}

    await audio_webrtc_event_internal({
        "sid": data.get("sid", ""),
        "event_type": event_type,
        "event_data": event_data,
        "run_id": run_id,
    })


# Backward compatibility handlers removed - now handled by simulations/audio/forward.py


register_server_endpoint(
    server_router,
    "/audio/events",
    AudioWebRTCEventApiRequest,
    "Handle WebRTC forwarding events",
)

