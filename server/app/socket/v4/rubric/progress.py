"""Rubric progress handler - listens to internal progress events and emits to clients."""

from typing import Any

from app.main import get_internal_sio, sio
from fastapi import APIRouter

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_progress")  # type: ignore
async def handle_rubric_progress(data: dict[str, Any]) -> None:
    """Handle generate_progress internal event - filter by resource_type and emit to client."""
    # Filter by modality (rubrics are text-based) and resource_type
    modality = data.get("modality", "text")
    if modality != "text":
        return  # Not for us

    if data.get("resource_type") != "rubric":
        return  # Not for us

    sid = data.get("sid", "")
    if not sid:
        return  # No socket ID, can't emit to client

    # Transform internal event format to client format
    progress_type = data.get("type", "")

    # Map internal progress_type to client type
    if progress_type == "tool_call_start":
        client_type = "tool_call"
        message = f"Starting {data.get('tool_name', 'tool')}..."
    elif progress_type == "tool_call_progress":
        client_type = "tool_call"
        message = f"Generating {data.get('tool_name', 'descriptions')}..."
    elif progress_type == "start":
        client_type = "start"
        message = data.get("message", "Starting rubric generation...")
    else:
        client_type = "progress"
        message = data.get("message", "Processing...")

    # Emit unified client event
    await sio.emit(
        "artifact_generation_progress",
        {
            "resource_type": "rubric",
            "resource_id": data.get("resource_id"),
            "run_id": data.get("run_id"),
            "type": client_type,
            "message": message,
            "tool_call_id": data.get("tool_call_id"),
            "tool_name": data.get("tool_name"),
            "trace_id": data.get("trace_id"),
        },
        room=sid,
    )
