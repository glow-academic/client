"""Persona error handler - listens to internal error events and emits to clients."""

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


@internal_sio.on("generate_error")  # type: ignore
async def handle_personas_error(data: dict[str, Any]) -> None:
    """Handle generate_error internal event - filter by persona resource_type and emit to client."""
    # Filter by resource_type
    resource_type = data.get("resource_type")

    # Check if resource_type is a persona resource type
    # Also check if resource_types array contains any persona resource types
    resource_types = data.get("resource_types", [])
    is_persona_resource = resource_type in PERSONA_RESOURCE_TYPES or any(
        rt in PERSONA_RESOURCE_TYPES for rt in resource_types
    )

    if not is_persona_resource:
        return  # Not for us

    sid = data.get("sid", "")
    if not sid:
        return  # No socket ID, can't emit to client

    error_message = data.get("error_message") or data.get(
        "message", "An error occurred during persona generation"
    )
    error_payload = {
        "resource_type": resource_type,
        "resource_id": data.get("resource_id"),
        "group_id": data.get("group_id"),
        "success": False,
        "message": error_message,
        "trace_id": data.get("trace_id"),
    }

    # Emit unified error event to client
    await sio.emit(
        "personas_generation_error",
        error_payload,
        room=sid,
    )
