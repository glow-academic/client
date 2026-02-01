"""Training simulation progress handler.

Listens to AI generation progress events and emits training-specific
progress updates to clients. Filters by artifact_type='training'.
"""

from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.training.types import TrainingProgressEvent
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

server_router = APIRouter()


@internal_sio.on("generate_call_start")  # type: ignore
@internal_sio.on("generate_call_progress")  # type: ignore
@internal_sio.on("generate_text_start")  # type: ignore
@internal_sio.on("generate_text_progress")  # type: ignore
async def handle_training_progress(data: dict[str, Any]) -> None:
    """Handle generate_*_progress events - filter by training artifact_type and emit training-specific event."""
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

    # Build progress event
    event = TrainingProgressEvent(
        artifact_type="training",
        group_id=data.get("group_id"),
        resource_type=data.get("resource_type"),
        resource_id=data.get("resource_id"),
        run_id=data.get("run_id"),
        modality=data.get("modality", "text"),
        type=data.get("type", "progress"),
        event_type=data.get("event_type"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
        arguments=data.get("arguments"),
        arguments_delta=data.get("arguments_delta"),
        trace_id=data.get("trace_id"),
        # Training-specific fields
        scenario_id=data.get("scenario_id"),
    )

    await sio.emit(
        "training_progress",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/training/progress", response_model=dict[str, bool])
async def training_progress_api(request: TrainingProgressEvent) -> dict[str, bool]:
    """Server-to-client event: Training generation progress update."""
    return {"success": True}
