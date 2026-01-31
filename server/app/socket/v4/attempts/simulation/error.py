"""Simulation attempt error handler - listens to generate_*_error events and emits attempt-specific events."""

from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import get_internal_sio, sio
from app.socket.v4.attempts.simulation.types import AttemptErrorEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/attempt/error", response_model=dict[str, bool])
async def attempt_error_api(request: AttemptErrorEvent) -> dict[str, bool]:
    """Server-to-client event: Attempt generation error."""
    return {"success": True}


@internal_sio.on("generate_text_error")  # type: ignore
@internal_sio.on("generate_call_error")  # type: ignore
async def handle_attempt_error(data: dict[str, Any]) -> None:
    """Handle generate_*_error events - filter by attempt artifact_type and emit attempt-specific event."""
    artifact_type = data.get("artifact_type")
    if artifact_type != "attempt":
        return  # Not for us

    sid = data.get("sid", "")
    if not sid:
        return  # No socket ID, can't emit to client

    # Get profile_id from sid to verify connection
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        # Still try to emit error even without valid profile
        pass

    error_message = data.get("error_message") or data.get(
        "message", "An error occurred during attempt generation"
    )
    chat_id = data.get("chat_id")
    message_id = data.get("message_id")

    # Emit attempt-specific error event
    error_event = AttemptErrorEvent(
        artifact_type="attempt",
        chat_id=chat_id,
        message_id=message_id,
        group_id=data.get("group_id"),
        resource_type=data.get("resource_type"),
        success=False,
        message=error_message,
        trace_id=data.get("trace_id"),
    )
    await sio.emit(
        "attempt_error",
        error_event.model_dump(mode="json"),
        room=sid,
    )
