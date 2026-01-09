"""Listen for generic audio events and forward to client with simulation context.

This module listens for generic audio_* events from the audio handler,
looks up simulation context (chat_id) from run_id, and emits
simulation_voice_* events to the client.
"""

import uuid
from typing import Any

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

# Map generic audio events to simulation-specific events
AUDIO_TO_SIMULATION_EVENT_MAP = {
    "audio_user_start": "simulation_voice_user_start",
    "audio_user_progress": "simulation_voice_user_progress",
    "audio_user_complete": "simulation_voice_user_complete",
    "audio_assistant_start": "simulation_voice_assistant_start",
    "audio_assistant_progress": "simulation_voice_assistant_delta",
    "audio_assistant_complete": "simulation_voice_assistant_done",
    "audio_tool_call_start": "simulation_voice_tool_call_start",
    "audio_tool_call_progress": "simulation_voice_tool_call_progress",
    "audio_tool_call_complete": "simulation_voice_tool_call_complete",
    "audio_user_audio_link": "simulation_voice_user_audio_link",
    "audio_assistant_audio_link": "simulation_voice_assistant_audio_link",
    "audio_session_usage": "simulation_voice_usage",
    "audio_session_interrupt": "simulation_voice_interrupt",
    "audio_error": "simulation_voice_error",
}


async def _get_chat_id_from_run_id(run_id: uuid.UUID) -> uuid.UUID | None:
    """Get chat_id from run_id via database query.

    Args:
        run_id: Run ID

    Returns:
        Chat ID if found, None otherwise
    """
    try:
        async with get_db_connection() as conn:
            # Query: runs → group_runs → groups → chat_groups → chats
            query = """
                SELECT DISTINCT c.id as chat_id
                FROM runs r
                JOIN group_runs gr ON gr.run_id = r.id
                JOIN groups g ON g.id = gr.group_id
                JOIN chat_groups cg ON cg.group_id = g.id
                JOIN chats c ON c.id = cg.chat_id
                WHERE r.id = $1
                LIMIT 1
            """
            result = await conn.fetchrow(query, run_id)
            if result and result["chat_id"]:
                return result["chat_id"]
    except Exception:
        pass
    return None


async def _forward_audio_event_to_simulation(
    event_name: str, data: dict[str, Any]
) -> None:
    """Forward generic audio event to client with simulation context.

    Args:
        event_name: Generic audio event name (e.g., "audio_user_start")
        data: Event payload with run_id and event data
    """
    # Map to simulation-specific event name
    simulation_event_name = AUDIO_TO_SIMULATION_EVENT_MAP.get(event_name)
    if not simulation_event_name:
        return

    # Extract run_id from data
    run_id_str = data.get("run_id")
    if not run_id_str:
        return

    try:
        run_id = uuid.UUID(run_id_str)
    except (ValueError, TypeError):
        return

    # Get chat_id from run_id
    chat_id = await _get_chat_id_from_run_id(run_id)
    if not chat_id:
        # No chat_id found - this might be a benchmark or other non-simulation use case
        # Don't forward to simulation clients
        return

    # Extract event_data from payload
    event_data = data.get("event_data", {})

    # Build simulation event payload with chat_id
    simulation_payload = {
        **event_data,
        "chat_id": str(chat_id),
        "run_id": run_id_str,
    }

    # Emit to simulation room
    room_name = f"simulation_{chat_id}"
    await sio.emit(simulation_event_name, simulation_payload, room=room_name)


# Register handlers for all generic audio_* events
@internal_sio.on("audio_user_start")  # type: ignore
async def audio_user_start_listener(data: dict[str, Any]) -> None:
    """Listen for audio_user_start and forward to simulation clients."""
    await _forward_audio_event_to_simulation("audio_user_start", data)


@internal_sio.on("audio_user_progress")  # type: ignore
async def audio_user_progress_listener(data: dict[str, Any]) -> None:
    """Listen for audio_user_progress and forward to simulation clients."""
    await _forward_audio_event_to_simulation("audio_user_progress", data)


@internal_sio.on("audio_user_complete")  # type: ignore
async def audio_user_complete_listener(data: dict[str, Any]) -> None:
    """Listen for audio_user_complete and forward to simulation clients."""
    await _forward_audio_event_to_simulation("audio_user_complete", data)


@internal_sio.on("audio_assistant_start")  # type: ignore
async def audio_assistant_start_listener(data: dict[str, Any]) -> None:
    """Listen for audio_assistant_start and forward to simulation clients."""
    await _forward_audio_event_to_simulation("audio_assistant_start", data)


@internal_sio.on("audio_assistant_progress")  # type: ignore
async def audio_assistant_progress_listener(data: dict[str, Any]) -> None:
    """Listen for audio_assistant_progress and forward to simulation clients."""
    await _forward_audio_event_to_simulation("audio_assistant_progress", data)


@internal_sio.on("audio_assistant_complete")  # type: ignore
async def audio_assistant_complete_listener(data: dict[str, Any]) -> None:
    """Listen for audio_assistant_complete and forward to simulation clients."""
    await _forward_audio_event_to_simulation("audio_assistant_complete", data)


@internal_sio.on("audio_tool_call_start")  # type: ignore
async def audio_tool_call_start_listener(data: dict[str, Any]) -> None:
    """Listen for audio_tool_call_start and forward to simulation clients."""
    await _forward_audio_event_to_simulation("audio_tool_call_start", data)


@internal_sio.on("audio_tool_call_progress")  # type: ignore
async def audio_tool_call_progress_listener(data: dict[str, Any]) -> None:
    """Listen for audio_tool_call_progress and forward to simulation clients."""
    await _forward_audio_event_to_simulation("audio_tool_call_progress", data)


@internal_sio.on("audio_tool_call_complete")  # type: ignore
async def audio_tool_call_complete_listener(data: dict[str, Any]) -> None:
    """Listen for audio_tool_call_complete and forward to simulation clients."""
    await _forward_audio_event_to_simulation("audio_tool_call_complete", data)


@internal_sio.on("audio_user_audio_link")  # type: ignore
async def audio_user_audio_link_listener(data: dict[str, Any]) -> None:
    """Listen for audio_user_audio_link and forward to simulation clients."""
    await _forward_audio_event_to_simulation("audio_user_audio_link", data)


@internal_sio.on("audio_assistant_audio_link")  # type: ignore
async def audio_assistant_audio_link_listener(data: dict[str, Any]) -> None:
    """Listen for audio_assistant_audio_link and forward to simulation clients."""
    await _forward_audio_event_to_simulation("audio_assistant_audio_link", data)


@internal_sio.on("audio_session_usage")  # type: ignore
async def audio_session_usage_listener(data: dict[str, Any]) -> None:
    """Listen for audio_session_usage and forward to simulation clients."""
    await _forward_audio_event_to_simulation("audio_session_usage", data)


@internal_sio.on("audio_session_interrupt")  # type: ignore
async def audio_session_interrupt_listener(data: dict[str, Any]) -> None:
    """Listen for audio_session_interrupt and forward to simulation clients."""
    await _forward_audio_event_to_simulation("audio_session_interrupt", data)


@internal_sio.on("audio_error")  # type: ignore
async def audio_error_listener(data: dict[str, Any]) -> None:
    """Listen for audio_error and forward to simulation clients."""
    await _forward_audio_event_to_simulation("audio_error", data)
