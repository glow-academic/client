"""Training simulation complete handler.

Listens to AI generation completion events and emits training-specific
completion updates to clients. Filters by artifact_type='training'.
"""

from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.training.types import TrainingCompleteEvent
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_training_complete(data: dict[str, Any]) -> None:
    """Handle generate_*_complete events - filter by training artifact_type and emit training-specific event."""
    # Skip processing if in eval mode
    eval_mode = data.get("eval_mode", False)
    if eval_mode:
        return

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

    # Build complete event
    event = TrainingCompleteEvent(
        artifact_type="training",
        group_id=data.get("group_id", ""),
        resource_type=data.get("resource_type", "training"),
        run_id=data.get("run_id"),
        success=True,
        message="Training generation completed",
        # Training-specific fields
        scenario_id=data.get("scenario_id"),
    )

    await sio.emit(
        "training_complete",
        event.model_dump(mode="json"),
        room=sid,
    )

    logger.info(
        f"Training complete - scenario_id={data.get('scenario_id')}"
    )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/training/complete", response_model=dict[str, bool])
async def training_complete_api(request: TrainingCompleteEvent) -> dict[str, bool]:
    """Server-to-client event: Training generation completed."""
    return {"success": True}
