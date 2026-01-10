"""Artifact progress handler - listens to internal progress events and routes by modality."""

from typing import Any

from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio, sio
from fastapi import APIRouter

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_progress")  # type: ignore
async def handle_artifact_progress(data: dict[str, Any]) -> None:
    """Route progress events by output modality."""
    # Extract modality from payload
    modality = data.get("modality", "text")
    
    sid = data.get("sid", "")
    if not sid:
        return  # No socket ID, can't emit to client

    # Transform internal event format to client format
    progress_type = data.get("type", "")
    
    # Map progress types to client format
    if progress_type == "tool_call_start":
        client_type = "tool_call"
        message = f"Starting {data.get('tool_name', 'tool')}..."
    elif progress_type == "tool_call_progress":
        client_type = "tool_call"
        message = f"Generating {data.get('tool_name', 'tool')}..."
    elif progress_type == "tool_call_complete":
        client_type = "tool_call"
        message = f"Completed {data.get('tool_name', 'tool')}..."
    elif progress_type == "token":
        client_type = "token"
        message = None  # Text is streamed directly
    elif progress_type == "start":
        client_type = "start"
        message = data.get("message", f"Starting {modality} generation...")
    elif progress_type == "polling":
        client_type = "status"
        message = data.get("message", "Processing...")
    elif progress_type == "session_started" or progress_type == "session_created":
        client_type = "session_started"
        message = "Audio session started"
    elif progress_type in ("user_speech_started", "user_speech_stopped", "user_transcription_complete",
                           "response_started", "output_item_added", "output_item_done",
                           "audio_transcript_delta", "audio_transcript_done", "audio_delta"):
        # Audio-specific events - pass through with original type
        client_type = progress_type
        message = data.get("message")
    else:
        client_type = "progress"
        message = data.get("message", "Processing...")

    # Emit unified client event
    await sio.emit(
        "artifact_generation_progress",
        {
            "modality": modality,
            "resource_type": data.get("resource_type"),
            "resource_id": data.get("resource_id"),
            "run_id": data.get("run_id"),
            "group_id": data.get("group_id"),
            "type": client_type,
            "message": message,
            "text": data.get("text"),  # For token events
            "tool_call_id": data.get("tool_call_id"),
            "tool_name": data.get("tool_name"),
            "arguments": data.get("arguments"),
            "arguments_delta": data.get("arguments_delta"),
            "status": data.get("status"),
            "progress": data.get("progress"),
            "ephemeral_key": data.get("ephemeral_key"),  # For audio session (deprecated)
            "expires_in": data.get("expires_in"),  # For audio session (deprecated)
            "model": data.get("model"),  # For audio session
            "trace_id": data.get("trace_id"),
            # Audio-specific fields
            "item_id": data.get("item_id"),
            "audio_start_ms": data.get("audio_start_ms"),
            "transcript": data.get("transcript"),
            "response_id": data.get("response_id"),
            "output_type": data.get("output_type"),
            "audio": data.get("audio"),  # Base64 audio data
            "call_id": data.get("call_id"),
            "function_call": data.get("function_call"),
        },
        room=sid,
    )


# Note: register_server_endpoint requires a type, but we handle unified events
# The endpoint registration is handled by the @internal_sio.on decorator above
