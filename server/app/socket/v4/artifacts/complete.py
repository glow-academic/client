"""Artifact completion handler - listens to internal completion events and routes by modality."""

from typing import Any

from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio, sio
from fastapi import APIRouter

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_complete")  # type: ignore
async def handle_artifact_complete(data: dict[str, Any]) -> None:
    """Route completion events by output modality."""
    # Extract modality from payload
    modality = data.get("modality", "text")
    
    sid = data.get("sid", "")
    if not sid:
        return  # No socket ID, can't emit to client

    # Transform internal event format to client format
    completion_type = data.get("type", "run_complete")
    
    # Build client payload based on modality
    client_payload: dict[str, Any] = {
        "modality": modality,
        "resource_type": data.get("resource_type"),
        "resource_id": data.get("resource_id"),
        "run_id": data.get("run_id"),
        "group_id": data.get("group_id"),
        "type": completion_type,
    }

    # Add modality-specific fields
    if modality == "text" or modality == "call" or modality == "document":
        client_payload.update({
            "input_text_tokens": data.get("input_text_tokens"),
            "output_text_tokens": data.get("output_text_tokens"),
            "system_prompt": data.get("system_prompt"),
            "assistant_output": data.get("assistant_output"),
        })
    elif modality == "image":
        client_payload.update({
            "image_id": data.get("image_id"),
            "file_path": data.get("file_path"),
            "mime_type": data.get("mime_type"),
            "file_size": data.get("file_size"),
        })
    elif modality == "video":
        client_payload.update({
            "success": data.get("success", True),
            "message": data.get("message"),
            "videoUrl": data.get("videoUrl"),
            "video_id": data.get("video_id"),
        })
    elif modality == "audio":
        client_payload.update({
            "model": data.get("model"),
        })

    # Emit unified client event
    await sio.emit(
        "artifact_generation_complete",
        client_payload,
        room=sid,
    )


# Note: register_server_endpoint requires a type, but we handle multiple event types
# The endpoint registration is handled by the @internal_sio.on decorators above
