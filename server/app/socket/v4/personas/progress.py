"""Persona progress handler - listens to artifact_generation_progress events and re-emits to clients."""

from typing import Any

from app.main import get_internal_sio, sio
from fastapi import APIRouter

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

# Persona resource types
PERSONA_RESOURCE_TYPES = [
    "names",
    "descriptions",
    "colors",
    "icons",
    "instructions",
    "flags",
    "examples",
    "fields",
    "departments",
]


@internal_sio.on("generate_progress")  # type: ignore
async def handle_personas_progress(data: dict[str, Any]) -> None:
    """Handle generate_progress internal event - filter by persona artifact_type and re-emit to client."""
    # Filter by artifact_type
    artifact_type = data.get("artifact_type")
    if artifact_type != "persona":
        return  # Not for us

    resource_type = data.get("resource_type")
    if resource_type not in PERSONA_RESOURCE_TYPES:
        return  # Not for us

    sid = data.get("sid", "")
    if not sid:
        return  # No socket ID, can't emit to client

    # Re-emit unified client event (client already listens to artifact_generation_progress)
    # Include all fields from the internal event
    await sio.emit(
        "artifact_generation_progress",
        {
            "modality": data.get("modality", "text"),
            "artifact_type": artifact_type,
            "resource_type": resource_type,
            "resource_id": data.get("resource_id"),
            "run_id": data.get("run_id"),
            "group_id": data.get("group_id"),
            "type": data.get("type", "progress"),
            "message": data.get("message", "Processing..."),
            "tool_call_id": data.get("tool_call_id"),
            "tool_name": data.get("tool_name"),
            "trace_id": data.get("trace_id"),
        },
        room=sid,
    )
