"""Handler for generate_error WebSocket event - top-level error handler that propagates to agent error handlers."""

import uuid
from typing import Any

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio
from fastapi import APIRouter
from pydantic import BaseModel

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class GenerateErrorApiRequest(BaseModel):
    """Payload for generation error events."""

    sid: str
    error_message: str
    artifact_type: str | None = None  # Artifact type (e.g., "persona")
    group_id: str | None = None
    resource_type: str | None = None  # Still needed for tool routing
    resource_types: list[str] | None = None  # Optional: original resource_types array


# Mapping from agent_role to agent error event name
AGENT_ERROR_MAPPING = {
    "scenario": "scenario_error",
    "document": "document_error",
    "simulation": "simulation_error",
    "grade": "grade_error",
    "hint": "hint_error",
    "classify": "classify_error",
    "member": "member_error",
    "prompt": "prompt_error",
    "rubric": "rubric_error",
    "title": "title_error",
    "audio": "audio_error",
    "image": "image_error",
    "video": "video_error",
    "voice": "voice_error",
}


async def _generate_error_impl(
    sid: str,
    data: GenerateErrorApiRequest,
    profile_id: uuid.UUID,
) -> None:
    """Top-level error handler - routes to agent-specific error handlers."""
    try:
        # Determine agent error event name from artifact_type (preferred) or resource_type (fallback)
        # Use artifact_type for routing if available, otherwise fall back to resource_type
        routing_key = data.artifact_type or data.resource_type or "text"
        agent_error_event = AGENT_ERROR_MAPPING.get(routing_key, "text_error")

        # Dispatch to agent-specific error handler
        await internal_sio.emit(
            agent_error_event,
            {
                "sid": sid,
                "success": False,
                "message": data.error_message,
                "artifact_type": data.artifact_type,
                "group_id": data.group_id,
            },
        )

        # Also emit resource_error for resource handlers (like persona/scenario/simulation)
        # Resource handlers listen to resource_error instead of agent-specific events
        if data.artifact_type:
            await internal_sio.emit(
                "resource_error",
                {
                    "sid": sid,
                    "success": False,
                    "error_message": data.error_message,
                    "message": data.error_message,
                    "artifact_type": data.artifact_type,
                    "group_id": data.group_id,
                    "resource_type": data.resource_type,
                    "resource_types": data.resource_types,
                },
            )
    except Exception as e:
        # If routing fails, try to emit to a generic error handler
        # This should not happen, but provides fallback
        try:
            await internal_sio.emit(
                "text_error",
                {
                    "sid": sid,
                    "success": False,
                    "message": f"Error routing failed: {str(e)}",
                    "artifact_type": data.artifact_type,
                    "group_id": data.group_id,
                },
            )
        except Exception:
            pass


@internal_sio.on("generate_error")  # type: ignore
async def generate_error_internal(data: dict[str, Any]) -> None:
    """Handle generate_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=GenerateErrorApiRequest,
        handler=_generate_error_impl,  # type: ignore[arg-type]
        error_event_name="generate_error",
        error_response_type=GenerateErrorApiRequest,
    )


register_server_endpoint(
    server_router,
    "/generate_error",
    GenerateErrorApiRequest,
    "Top-level error handler for generation errors",
)
