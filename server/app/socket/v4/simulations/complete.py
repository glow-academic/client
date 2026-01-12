"""Simulation completion handler - listens to generate_complete events and emits simulation-specific events."""

import uuid
from typing import Any

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()


@internal_sio.on("generate_complete")  # type: ignore
async def handle_simulations_complete(data: dict[str, Any]) -> None:
    """Handle generate_complete internal event - filter by simulation artifact_type and voice resource_type."""
    # Filter by artifact_type and resource_type
    artifact_type = data.get("artifact_type")
    resource_type = data.get("resource_type")
    modality = data.get("modality")
    
    if artifact_type != "simulation" or resource_type != "voice" or modality != "audio":
        return  # Not for us
    
    sid = data.get("sid", "")
    if not sid:
        return  # No socket ID, can't emit to client
    
    # Get profile_id from sid
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return
    
    # Extract completion data
    chat_id = data.get("group_id")  # group_id contains chat_id for simulations
    run_id = data.get("run_id")
    completion_type = data.get("type")
    
    # Emit completion event to client
    await sio.emit(
        "simulation_voice_complete",
        {
            "chat_id": chat_id,
            "run_id": run_id,
            "type": completion_type,
            "success": True,
        },
        room=sid,
    )
