"""Simulation progress handler - listens to generate_progress events and emits simulation-specific events."""

import uuid
from datetime import UTC, datetime
from typing import Any

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()


@internal_sio.on("generate_progress")  # type: ignore
async def handle_simulations_progress(data: dict[str, Any]) -> None:
    """Handle generate_progress internal event - filter by simulation artifact_type and voice resource_type."""
    # Filter by artifact_type
    artifact_type = data.get("artifact_type")
    if artifact_type != "simulation":
        return  # Not for us

    resource_type = data.get("resource_type")
    modality = data.get("modality")
    
    sid = data.get("sid", "")
    if not sid:
        return  # No socket ID, can't emit to client
    
    # Get profile_id from sid
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return
    
    # Extract event type and map to simulation events
    event_type = data.get("type")
    chat_id = data.get("group_id")  # group_id contains chat_id for simulations
    message_id = data.get("message_id")

    if modality in ("text", "call", "document") and resource_type == "simulation":
        if event_type == "text_start" and message_id:
            await sio.emit(
                "simulation_text_new_message",
                {
                    "message_id": message_id,
                    "chat_id": chat_id,
                    "role": "assistant",
                    "content": "",
                    "completed": False,
                    "created_at": datetime.now(UTC).isoformat(),
                },
                room=sid,
            )
        elif event_type == "text_delta" and message_id:
            await sio.emit(
                "simulation_text_message_token",
                {
                    "message_id": message_id,
                    "chat_id": chat_id,
                    "token": data.get("delta", ""),
                    "accumulated_content": data.get("accumulated_content", ""),
                },
                room=sid,
            )
        elif event_type == "text_complete" and message_id:
            await sio.emit(
                "simulation_text_message_complete",
                {
                    "message_id": message_id,
                    "chat_id": chat_id,
                    "final_content": data.get("text", ""),
                    "completed": True,
                },
                room=sid,
            )
        return

    # Map artifact event types to simulation events
    if modality != "audio" or resource_type != "voice":
        return  # Not for us

    if event_type == "user_speech_started":
        await sio.emit(
            "simulation_voice_user_start",
            {
                "chat_id": chat_id,
                "item_id": data.get("item_id"),
                "audio_start_ms": data.get("audio_start_ms", 0),
            },
            room=sid,
        )
    elif event_type == "user_transcription_complete":
        await sio.emit(
            "simulation_voice_user_complete",
            {
                "chat_id": chat_id,
                "item_id": data.get("item_id"),
                "transcript": data.get("transcript"),
            },
            room=sid,
        )
    elif event_type == "audio_delta":
        # Audio delta is handled by frames.py client WS sender
        # But we can also emit a progress event if needed
        await sio.emit(
            "simulation_voice_assistant_delta",
            {
                "chat_id": chat_id,
                "message_id": message_id,
                "audio": data.get("audio"),  # Base64 encoded audio
            },
            room=sid,
        )
    elif event_type == "response_started":
        await sio.emit(
            "simulation_voice_assistant_start",
            {
                "chat_id": chat_id,
                "response_id": data.get("response_id"),
                "message_id": message_id,
            },
            room=sid,
        )
    elif event_type == "response_done":
        await sio.emit(
            "simulation_voice_assistant_done",
            {
                "chat_id": chat_id,
                "response_id": data.get("response_id"),
                "message_id": message_id,
            },
            room=sid,
        )
    elif event_type == "tool_call_progress":
        await sio.emit(
            "simulation_voice_tool_call_progress",
            {
                "chat_id": chat_id,
                "call_id": data.get("call_id"),
                "arguments_delta": data.get("arguments_delta"),
                "message_id": message_id,
            },
            room=sid,
        )
    elif event_type == "tool_call_complete":
        await sio.emit(
            "simulation_voice_tool_call_complete",
            {
                "chat_id": chat_id,
                "call_id": data.get("call_id"),
                "function_call": data.get("function_call"),
                "message_id": message_id,
            },
            room=sid,
        )
    elif event_type == "session_started":
        # Emit session config to client
        await sio.emit(
            "simulation_voice_start_response",
            {
                "success": True,
                "message": "Voice session started successfully",
                "model": data.get("model"),
            },
            room=sid,
        )
    elif event_type == "session_created":
        # Session ready
        await sio.emit(
            "simulation_voice_session_ready",
            {
                "chat_id": chat_id,
            },
            room=sid,
        )
