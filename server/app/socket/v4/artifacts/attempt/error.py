"""Attempt simulation error handler.

Listens to AI generation error events and emits attempt-specific
error updates to clients. Filters by artifact_type='attempt'.
"""

from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.attempt.run_store import remove_run_context
from app.socket.v4.artifacts.attempt.types import AttemptErrorEvent
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import get_internal_sio, sio
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

server_router = APIRouter()


@internal_sio.on("generate_call_error")  # type: ignore
@internal_sio.on("generate_text_error")  # type: ignore
async def handle_attempt_error(data: dict[str, Any]) -> None:
    """Handle generate_*_error events - filter by attempt artifact_type and emit attempt-specific event."""
    # Filter by artifact_type (early return for efficiency)
    artifact_type = data.get("artifact_type")
    if artifact_type != "attempt":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    # Verify profile still connected
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    # Extract error message
    error_message = data.get("error_message") or data.get(
        "message", "An error occurred during attempt generation"
    )

    # Build error event
    event = AttemptErrorEvent(
        artifact_type="attempt",
        group_id=data.get("group_id"),
        resource_type=data.get("resource_type"),
        resource_types=data.get("resource_types"),
        resource_id=data.get("resource_id"),
        run_id=data.get("run_id"),
        success=False,
        message=error_message,
        trace_id=data.get("trace_id"),
    )

    await sio.emit(
        "attempt_error",
        event.model_dump(mode="json"),
        room=sid,
    )

    remove_run_context(data.get("run_id"))

    logger.error(
        f"Attempt generation error - "
        f"run_id={data.get('run_id')}, error: {error_message}"
    )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/attempt/error", response_model=dict[str, bool])
async def attempt_error_api(request: AttemptErrorEvent) -> dict[str, bool]:
    """Server-to-client event: Attempt generation error occurred."""
    return {"success": True}
