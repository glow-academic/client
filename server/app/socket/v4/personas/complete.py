"""Persona completion handler - listens to internal completion events and emits to clients."""

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


@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_personas_complete(data: dict[str, Any]) -> None:
    """Handle generate_text_complete internal event - filter by persona resource_type and emit to client."""
    # Filter by resource_type
    resource_type = data.get("resource_type")
    if resource_type not in PERSONA_RESOURCE_TYPES:
        return  # Not for us

    sid = data.get("sid", "")
    if not sid:
        return  # No socket ID, can't emit to client

    completion_type = data.get("type", "run_complete")
    resource_id = data.get("resource_id")
    run_id = data.get("run_id")

    try:
        # For now, emit dummy completion event (skeleton implementation)
        # TODO: Fetch tool results from database and format for client
        if completion_type == "tool_call_complete":
            # Handle tool call completion
            tool_name = data.get("tool_name", "")
            await sio.emit(
                "personas_generation_complete",
                {
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                    "run_id": run_id,
                    "group_id": data.get("group_id"),
                    "tool_name": tool_name,
                    "tool_call_id": data.get("tool_call_id"),
                    "success": True,
                    "message": f"{resource_type} generation completed successfully",
                    "trace_id": data.get("trace_id"),
                },
                room=sid,
            )
        elif completion_type == "run_complete":
            # Handle run completion
            await sio.emit(
                "personas_generation_complete",
                {
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                    "run_id": run_id,
                    "group_id": data.get("group_id"),
                    "success": True,
                    "message": f"{resource_type} generation completed successfully",
                    "trace_id": data.get("trace_id"),
                },
                room=sid,
            )

    except Exception as e:
        # Emit error to client
        await sio.emit(
            "personas_generation_error",
            {
                "resource_type": resource_type,
                "resource_id": resource_id,
                "group_id": data.get("group_id"),
                "success": False,
                "message": f"Failed to handle {resource_type} completion: {str(e)}",
                "trace_id": data.get("trace_id"),
            },
            room=sid,
        )
