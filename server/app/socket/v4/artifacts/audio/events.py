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

from ..adapters.openai.audio.adapter import OpenAIAudioAdapter

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


# Backward compatibility: Map old simulation_voice_* events to new audio_webrtc_* events
OLD_TO_NEW_EVENT_MAPPING = {
    "simulation_voice_user_start": "audio_user_start",
    "simulation_voice_user_progress": "audio_user_progress",
    "simulation_voice_user_complete": "audio_user_complete",
    "simulation_voice_assistant_start": "audio_assistant_start",
    "simulation_voice_assistant_delta": "audio_assistant_progress",
    "simulation_voice_assistant_done": "audio_assistant_complete",
    "simulation_voice_tool_call_start": "audio_tool_call_start",
    "simulation_voice_tool_call_progress": "audio_tool_call_progress",
    "simulation_voice_tool_call_complete": "audio_tool_call_complete",
    "simulation_voice_user_audio_link": "audio_user_audio_link",
    "simulation_voice_assistant_audio_link": "audio_assistant_audio_link",
    "simulation_voice_usage": "audio_session_usage",
    "simulation_voice_interrupt": "audio_session_interrupt",
    "simulation_voice_error": "audio_error",
}


@internal_sio.on("simulation_voice_user_start")  # type: ignore
async def simulation_voice_user_start_backward_compat(data: dict[str, Any]) -> None:
    """Backward compatibility: Map simulation_voice_user_start to audio_user_start."""
    await _map_old_event_to_new("simulation_voice_user_start", data)


@internal_sio.on("simulation_voice_user_progress")  # type: ignore
async def simulation_voice_user_progress_backward_compat(data: dict[str, Any]) -> None:
    """Backward compatibility: Map simulation_voice_user_progress to audio_user_progress."""
    await _map_old_event_to_new("simulation_voice_user_progress", data)


@internal_sio.on("simulation_voice_user_complete")  # type: ignore
async def simulation_voice_user_complete_backward_compat(data: dict[str, Any]) -> None:
    """Backward compatibility: Map simulation_voice_user_complete to audio_user_complete."""
    await _map_old_event_to_new("simulation_voice_user_complete", data)


@internal_sio.on("simulation_voice_assistant_start")  # type: ignore
async def simulation_voice_assistant_start_backward_compat(data: dict[str, Any]) -> None:
    """Backward compatibility: Map simulation_voice_assistant_start to audio_assistant_start."""
    await _map_old_event_to_new("simulation_voice_assistant_start", data)


@internal_sio.on("simulation_voice_assistant_delta")  # type: ignore
async def simulation_voice_assistant_delta_backward_compat(data: dict[str, Any]) -> None:
    """Backward compatibility: Map simulation_voice_assistant_delta to audio_assistant_progress."""
    await _map_old_event_to_new("simulation_voice_assistant_delta", data)


@internal_sio.on("simulation_voice_assistant_done")  # type: ignore
async def simulation_voice_assistant_done_backward_compat(data: dict[str, Any]) -> None:
    """Backward compatibility: Map simulation_voice_assistant_done to audio_assistant_complete."""
    await _map_old_event_to_new("simulation_voice_assistant_done", data)


@internal_sio.on("simulation_voice_tool_call_start")  # type: ignore
async def simulation_voice_tool_call_start_backward_compat(data: dict[str, Any]) -> None:
    """Backward compatibility: Map simulation_voice_tool_call_start to audio_tool_call_start."""
    await _map_old_event_to_new("simulation_voice_tool_call_start", data)


@internal_sio.on("simulation_voice_tool_call_progress")  # type: ignore
async def simulation_voice_tool_call_progress_backward_compat(data: dict[str, Any]) -> None:
    """Backward compatibility: Map simulation_voice_tool_call_progress to audio_tool_call_progress."""
    await _map_old_event_to_new("simulation_voice_tool_call_progress", data)


@internal_sio.on("simulation_voice_tool_call_complete")  # type: ignore
async def simulation_voice_tool_call_complete_backward_compat(data: dict[str, Any]) -> None:
    """Backward compatibility: Map simulation_voice_tool_call_complete to audio_tool_call_complete."""
    await _map_old_event_to_new("simulation_voice_tool_call_complete", data)


@internal_sio.on("simulation_voice_user_audio_link")  # type: ignore
async def simulation_voice_user_audio_link_backward_compat(data: dict[str, Any]) -> None:
    """Backward compatibility: Map simulation_voice_user_audio_link to audio_user_audio_link."""
    await _map_old_event_to_new("simulation_voice_user_audio_link", data)


@internal_sio.on("simulation_voice_assistant_audio_link")  # type: ignore
async def simulation_voice_assistant_audio_link_backward_compat(data: dict[str, Any]) -> None:
    """Backward compatibility: Map simulation_voice_assistant_audio_link to audio_assistant_audio_link."""
    await _map_old_event_to_new("simulation_voice_assistant_audio_link", data)


@internal_sio.on("simulation_voice_usage")  # type: ignore
async def simulation_voice_usage_backward_compat(data: dict[str, Any]) -> None:
    """Backward compatibility: Map simulation_voice_usage to audio_session_usage."""
    await _map_old_event_to_new("simulation_voice_usage", data)


@internal_sio.on("simulation_voice_interrupt")  # type: ignore
async def simulation_voice_interrupt_backward_compat(data: dict[str, Any]) -> None:
    """Backward compatibility: Map simulation_voice_interrupt to audio_session_interrupt."""
    await _map_old_event_to_new("simulation_voice_interrupt", data)


@internal_sio.on("simulation_voice_error")  # type: ignore
async def simulation_voice_error_backward_compat(data: dict[str, Any]) -> None:
    """Backward compatibility: Map simulation_voice_error to audio_error."""
    await _map_old_event_to_new("simulation_voice_error", data)


async def _map_old_event_to_new(old_event_name: str, data: dict[str, Any]) -> None:
    """Map old simulation_voice_* event to new audio_webrtc_* event."""
    new_event_name = OLD_TO_NEW_EVENT_MAPPING.get(old_event_name)
    if not new_event_name:
        return

    # Extract run_id from data (may be in different fields)
    run_id = data.get("run_id") or data.get("model_run_id") or data.get("runId")
    if not run_id:
        return

    # Forward to new event handler
    await _forward_to_webrtc_handler(new_event_name, data)


register_server_endpoint(
    server_router,
    "/audio/events",
    AudioWebRTCEventApiRequest,
    "Handle WebRTC forwarding events",
)

