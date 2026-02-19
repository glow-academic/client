"""Reports error handler - listens to generate_*_error events and emits reports-specific events."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.reports.types import ReportsGenerationErrorEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/reports_generation_error")
async def reports_generation_error_api(
    request: ReportsGenerationErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Reports generation error.

    Emitted when reports resource generation fails.
    """
    return {"success": True}


@internal_sio.on("generate_call_error")  # type: ignore
@internal_sio.on("generate_text_error")  # type: ignore
async def handle_reports_error(data: dict[str, Any]) -> None:
    """Handle generate_*_error event - filter by reports artifact_type and emit reports-specific event."""
    # Filter by artifact_type
    artifact_type = data.get("artifact_type")
    if artifact_type != "reports":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    error_message = data.get("error_message") or data.get(
        "message", "An error occurred during reports generation"
    )

    resource_type = data.get("resource_type")
    resource_types = data.get("resource_types", [])

    # Emit reports-specific error event with all fields from internal event
    event = ReportsGenerationErrorEvent(
        artifact_type=artifact_type or "reports",
        group_id=data.get("group_id"),
        resource_type=resource_type,
        resource_types=resource_types if resource_types else None,
        resource_id=data.get("resource_id"),
        success=False,
        message=error_message,
        trace_id=data.get("trace_id"),
    )
    await sio.emit(
        "reports_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )
