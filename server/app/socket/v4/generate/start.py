"""Handler for generate_start WebSocket event - entry point for all generation requests."""

import uuid
from typing import Any

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio
from fastapi import APIRouter
from pydantic import BaseModel

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class GenerateStartApiRequest(BaseModel):
    """Standardized payload for generation start."""

    sid: str
    agent_id: str
    resource_id: str
    resource_type: str  # agent_role from SQL result
    department_id: str | None = None
    upload_id: str | None = None
    group_id: str | None = None  # Optional: for regeneration
    user_instructions: str | None = None  # Optional: for regeneration
    # Agent-specific fields for regeneration message creation
    message_id: str | None = None  # Original message for regeneration


# Mapping from agent_role to handler type
HANDLER_MAPPING = {
    # Text generation handlers
    "scenario": "text",
    "document": "text",
    "simulation": "text",
    "grade": "text",
    "hint": "text",
    "classify": "text",
    "member": "text",
    "prompt": "text",
    "rubric": "text",
    "title": "text",
    "audio": "text",
    # Image generation
    "image": "image",
    # Video generation
    "video": "video",
    # Audio generation (ephemeral sessions only)
    "voice": "audio",
}


async def _generate_start_impl(
    sid: str,
    data: GenerateStartApiRequest,
    profile_id: uuid.UUID,
) -> None:
    """Entry point for all generation requests - handles mapping, group creation, run creation, rate limiting."""
    try:
        async with get_db_connection() as conn:
            # Determine handler type from agent_role
            handler_type = HANDLER_MAPPING.get(data.resource_type, "text")
            
            # For regeneration: create regenerate user message if needed
            regenerate_message_id: uuid.UUID | None = None
            if data.group_id and data.message_id:
                # TODO: Create regenerate user message in database
                # For now, we'll pass user_instructions to SQL function
                # This should be implemented as a SQL function that creates the message atomically
                pass
            
            # Build payload for modality handler
            modality_payload = {
                "sid": sid,
                "agent_id": data.agent_id,
                "resource_id": data.resource_id,
                "resource_type": data.resource_type,
                "department_id": data.department_id,
                "upload_id": data.upload_id,
                "group_id": uuid.UUID(data.group_id) if data.group_id else None,
                "user_instructions": data.user_instructions,
            }
            
            # Dispatch to appropriate modality handler
            # Modality handlers will call their SQL functions which handle:
            # - Group creation (if group_id is None)
            # - Rate limiting validation
            # - Run creation
            if handler_type == "text":
                await internal_sio.emit("generate_text", modality_payload)
            elif handler_type == "image":
                await internal_sio.emit("generate_image", modality_payload)
            elif handler_type == "video":
                await internal_sio.emit("generate_video", modality_payload)
            elif handler_type == "audio":
                await internal_sio.emit("generate_audio", modality_payload)
            else:
                # Fallback to text generation
                await internal_sio.emit("generate_text", modality_payload)
                
    except Exception as e:
        # Emit error to generate_error handler
        await emit_to_internal(
            "generate_error",
            {
                "sid": sid,
                "error_message": f"Failed to start generation: {str(e)}",
                "resource_id": data.resource_id,
                "group_id": data.group_id,
                "resource_type": data.resource_type,
            },
            sid=sid,
        )


@internal_sio.on("generate_start")  # type: ignore
async def generate_start_internal(data: dict[str, Any]) -> None:
    """Handle generate_start event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=GenerateStartApiRequest,
        handler=_generate_start_impl,  # type: ignore[arg-type]
        error_event_name="generate_error",
        error_response_type=None,
    )


register_server_endpoint(
    server_router,
    "/generate_start",
    GenerateStartApiRequest,
    "Entry point for all generation requests",
)

