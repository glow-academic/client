"""Record error handler - listens to generate_*_error events and emits record-specific events."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.record.types import RecordGenerationErrorEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/record_generation_error")
async def record_generation_error_api(
    request: RecordGenerationErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Record generation error.

    Emitted when record resource generation fails.
    """
    return {"success": True}


@internal_sio.on("generate_call_error")  # type: ignore
@internal_sio.on("generate_text_error")  # type: ignore
async def handle_record_error(data: dict[str, Any]) -> None:
    """Handle generate_*_error event - filter by record artifact_type and emit record-specific event."""
    # Filter by artifact_type
    artifact_type = data.get("artifact_type")
    if artifact_type != "record":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    error_message = data.get("error_message") or data.get(
        "message", "An error occurred during record generation"
    )

    resource_type = data.get("resource_type")
    resource_types = data.get("resource_types", [])

    # Emit record-specific error event with all fields from internal event
    event = RecordGenerationErrorEvent(
        artifact_type=artifact_type or "record",
        group_id=data.get("group_id"),
        resource_type=resource_type,
        resource_types=resource_types if resource_types else None,
        resource_id=data.get("resource_id"),
        success=False,
        message=error_message,
        trace_id=data.get("trace_id"),
    )
    await sio.emit(
        "record_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )
