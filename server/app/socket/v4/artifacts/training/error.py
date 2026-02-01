"""Training simulation error handler.

Listens to AI generation error events and emits training-specific
error updates to clients. Filters by artifact_type='training'.
"""

from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.training.types import TrainingErrorEvent
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

server_router = APIRouter()


@internal_sio.on("generate_call_error")  # type: ignore
@internal_sio.on("generate_text_error")  # type: ignore
async def handle_training_error(data: dict[str, Any]) -> None:
    """Handle generate_*_error events - filter by training artifact_type and emit training-specific event."""
    # Filter by artifact_type (early return for efficiency)
    artifact_type = data.get("artifact_type")
    if artifact_type != "training":
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
        "message", "An error occurred during training generation"
    )

    # Build error event
    event = TrainingErrorEvent(
        artifact_type="training",
        group_id=data.get("group_id"),
        resource_type=data.get("resource_type"),
        resource_types=data.get("resource_types"),
        resource_id=data.get("resource_id"),
        success=False,
        message=error_message,
        trace_id=data.get("trace_id"),
        # Training-specific fields
        scenario_id=data.get("scenario_id"),
    )

    await sio.emit(
        "training_error",
        event.model_dump(mode="json"),
        room=sid,
    )

    logger.error(
        f"Training generation error - "
        f"scenario_id={data.get('scenario_id')}, "
        f"error: {error_message}"
    )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/training/error", response_model=dict[str, bool])
async def training_error_api(request: TrainingErrorEvent) -> dict[str, bool]:
    """Server-to-client event: Training generation error occurred."""
    return {"success": True}
