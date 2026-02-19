"""Session error handler - listens to generate_*_error events and emits session-specific events."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.session.types import SessionGenerationErrorEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/session_generation_error")
async def session_generation_error_api(
    request: SessionGenerationErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Session generation error.

    Emitted when session resource generation fails.
    """
    return {"success": True}


@internal_sio.on("generate_call_error")  # type: ignore
@internal_sio.on("generate_text_error")  # type: ignore
async def handle_session_error(data: dict[str, Any]) -> None:
    """Handle generate_*_error event - filter by session artifact_type and emit session-specific event."""
    # Filter by artifact_type
    artifact_type = data.get("artifact_type")
    if artifact_type != "session":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    error_message = data.get("error_message") or data.get(
        "message", "An error occurred during session generation"
    )

    resource_type = data.get("resource_type")
    resource_types = data.get("resource_types", [])

    # Emit session-specific error event with all fields from internal event
    event = SessionGenerationErrorEvent(
        artifact_type=artifact_type or "session",
        group_id=data.get("group_id"),
        resource_type=resource_type,
        resource_types=resource_types if resource_types else None,
        resource_id=data.get("resource_id"),
        success=False,
        message=error_message,
        trace_id=data.get("trace_id"),
    )
    await sio.emit(
        "session_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )
