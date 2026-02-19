"""Dashboard error handler - listens to generate_*_error events and emits dashboard-specific events."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.dashboard.types import DashboardGenerationErrorEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/dashboard_generation_error")
async def dashboard_generation_error_api(
    request: DashboardGenerationErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Dashboard generation error.

    Emitted when dashboard resource generation fails.
    """
    return {"success": True}


@internal_sio.on("generate_call_error")  # type: ignore
@internal_sio.on("generate_text_error")  # type: ignore
async def handle_dashboard_error(data: dict[str, Any]) -> None:
    """Handle generate_*_error event - filter by dashboard artifact_type and emit dashboard-specific event."""
    # Filter by artifact_type
    artifact_type = data.get("artifact_type")
    if artifact_type != "dashboard":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    error_message = data.get("error_message") or data.get(
        "message", "An error occurred during dashboard generation"
    )

    resource_type = data.get("resource_type")
    resource_types = data.get("resource_types", [])

    # Emit dashboard-specific error event with all fields from internal event
    event = DashboardGenerationErrorEvent(
        artifact_type=artifact_type or "dashboard",
        group_id=data.get("group_id"),
        resource_type=resource_type,
        resource_types=resource_types if resource_types else None,
        resource_id=data.get("resource_id"),
        success=False,
        message=error_message,
        trace_id=data.get("trace_id"),
    )
    await sio.emit(
        "dashboard_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )
