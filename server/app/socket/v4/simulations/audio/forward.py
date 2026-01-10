"""Forward simulation-specific audio events to generic audio handler.

This module receives simulation_voice_* events from the client,
extracts simulation context (chat_id, etc.), and forwards them
as generic audio_* events to the audio handler.
"""

import uuid
from typing import Any

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

# Map simulation-specific events to generic audio events
SIMULATION_TO_AUDIO_EVENT_MAP = {
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


async def _forward_simulation_event_to_audio(
    event_name: str, data: dict[str, Any], sid: str
) -> None:
    """Forward simulation event to generic audio handler.

    Args:
        event_name: Simulation event name (e.g., "simulation_voice_user_start")
        data: Event payload with chat_id and other simulation context
        sid: Socket ID
    """
    # Map to generic audio event name
    audio_event_name = SIMULATION_TO_AUDIO_EVENT_MAP.get(event_name)
    if not audio_event_name:
        return

    # Extract chat_id and run_id from data
    chat_id = data.get("chat_id")
    run_id = data.get("run_id") or data.get("model_run_id") or data.get("runId")

    # If no run_id, try to get it from chat_id
    if not run_id and chat_id:
        try:
            async with get_db_connection() as conn:
                # Query to get latest run_id for this chat
                # This is a fallback - ideally run_id should be provided
                query = """
                    SELECT r.id as run_id
                    FROM runs r
                    JOIN groups g ON r.group_id = g.id
                    WHERE g.chat_id = $1
                    ORDER BY r.created_at DESC
                    LIMIT 1
                """
                result = await conn.fetchrow(query, uuid.UUID(chat_id))
                if result:
                    run_id = str(result["run_id"])
        except Exception:
            pass

    if not run_id:
        # Cannot forward without run_id
        await sio.emit(
            "simulations_error",
            {
                "success": False,
                "message": f"Missing run_id for event {event_name}",
            },
            room=sid,
        )
        return

    # Extract event-specific data (everything except chat_id, sid, run_id)
    event_data = {
        k: v
        for k, v in data.items()
        if k not in ("chat_id", "sid", "run_id", "model_run_id", "runId")
    }

    # Forward to generic audio handler
    await emit_to_internal(
        "audio_webrtc_event",
        {
            "sid": sid,
            "event_type": audio_event_name,
            "event_data": event_data,
            "run_id": run_id,
        },
        sid=sid,
    )


# Register handlers for all simulation_voice_* events
@sio.event  # type: ignore
async def simulation_voice_user_start(sid: str, data: dict[str, Any]) -> None:
    """Handle simulation_voice_user_start event from client."""
    await _forward_simulation_event_to_audio("simulation_voice_user_start", data, sid)


@sio.event  # type: ignore
async def simulation_voice_user_progress(sid: str, data: dict[str, Any]) -> None:
    """Handle simulation_voice_user_progress event from client."""
    await _forward_simulation_event_to_audio(
        "simulation_voice_user_progress", data, sid
    )


@sio.event  # type: ignore
async def simulation_voice_user_complete(sid: str, data: dict[str, Any]) -> None:
    """Handle simulation_voice_user_complete event from client."""
    await _forward_simulation_event_to_audio(
        "simulation_voice_user_complete", data, sid
    )


@sio.event  # type: ignore
async def simulation_voice_assistant_start(sid: str, data: dict[str, Any]) -> None:
    """Handle simulation_voice_assistant_start event from client."""
    await _forward_simulation_event_to_audio(
        "simulation_voice_assistant_start", data, sid
    )


@sio.event  # type: ignore
async def simulation_voice_assistant_delta(sid: str, data: dict[str, Any]) -> None:
    """Handle simulation_voice_assistant_delta event from client."""
    await _forward_simulation_event_to_audio(
        "simulation_voice_assistant_delta", data, sid
    )


@sio.event  # type: ignore
async def simulation_voice_assistant_done(sid: str, data: dict[str, Any]) -> None:
    """Handle simulation_voice_assistant_done event from client."""
    await _forward_simulation_event_to_audio(
        "simulation_voice_assistant_done", data, sid
    )


@sio.event  # type: ignore
async def simulation_voice_tool_call_start(sid: str, data: dict[str, Any]) -> None:
    """Handle simulation_voice_tool_call_start event from client."""
    await _forward_simulation_event_to_audio(
        "simulation_voice_tool_call_start", data, sid
    )


@sio.event  # type: ignore
async def simulation_voice_tool_call_progress(sid: str, data: dict[str, Any]) -> None:
    """Handle simulation_voice_tool_call_progress event from client."""
    await _forward_simulation_event_to_audio(
        "simulation_voice_tool_call_progress", data, sid
    )


@sio.event  # type: ignore
async def simulation_voice_tool_call_complete(sid: str, data: dict[str, Any]) -> None:
    """Handle simulation_voice_tool_call_complete event from client."""
    await _forward_simulation_event_to_audio(
        "simulation_voice_tool_call_complete", data, sid
    )


@sio.event  # type: ignore
async def simulation_voice_user_audio_link(sid: str, data: dict[str, Any]) -> None:
    """Handle simulation_voice_user_audio_link event from client."""
    await _forward_simulation_event_to_audio(
        "simulation_voice_user_audio_link", data, sid
    )


@sio.event  # type: ignore
async def simulation_voice_assistant_audio_link(sid: str, data: dict[str, Any]) -> None:
    """Handle simulation_voice_assistant_audio_link event from client."""
    await _forward_simulation_event_to_audio(
        "simulation_voice_assistant_audio_link", data, sid
    )


@sio.event  # type: ignore
async def simulation_voice_usage(sid: str, data: dict[str, Any]) -> None:
    """Handle simulation_voice_usage event from client."""
    await _forward_simulation_event_to_audio("simulation_voice_usage", data, sid)


@sio.event  # type: ignore
async def simulation_voice_interrupt(sid: str, data: dict[str, Any]) -> None:
    """Handle simulation_voice_interrupt event from client."""
    await _forward_simulation_event_to_audio("simulation_voice_interrupt", data, sid)


@sio.event  # type: ignore
async def simulation_voice_error(sid: str, data: dict[str, Any]) -> None:
    """Handle simulation_voice_error event from client."""
    await _forward_simulation_event_to_audio("simulation_voice_error", data, sid)
