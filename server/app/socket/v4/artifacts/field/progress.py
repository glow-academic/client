"""Field progress handler - listens to generate_text_* events and emits field-specific events."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.field.types import FieldGenerationProgressEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/field_generation_progress")
async def field_generation_progress_api(
    request: FieldGenerationProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Field generation progress.

    Emitted during field resource generation to show progress.
    """
    return {"success": True}


@internal_sio.on("generate_call_start")  # type: ignore
@internal_sio.on("generate_call_progress")  # type: ignore
@internal_sio.on("generate_text_start")  # type: ignore
@internal_sio.on("generate_text_progress")  # type: ignore
async def handle_field_call_progress(data: dict[str, Any]) -> None:
    """Handle generate_call_* events - filter by field artifact_type and emit field-specific event."""
    artifact_type = data.get("artifact_type")
    if artifact_type != "field":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    resource_type = data.get("resource_type")
    if resource_type == "parameters":
        resource_type = "conditional_parameters"

    event = FieldGenerationProgressEvent(
        artifact_type=artifact_type or "field",
        group_id=data.get("group_id"),
        resource_type=resource_type,
        resource_id=data.get("resource_id"),
        run_id=data.get("run_id"),
        modality="call",
        type=data.get("type", "progress"),
        event_type=data.get("event_type"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
        arguments=data.get("arguments"),
        arguments_delta=data.get("arguments_delta"),
        trace_id=data.get("trace_id"),
    )
    await sio.emit(
        "field_generation_progress",
        event.model_dump(mode="json"),
        room=sid,
    )
