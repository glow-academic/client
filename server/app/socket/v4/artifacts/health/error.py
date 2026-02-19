"""Health error handler - listens to generate_*_error events and emits health-specific events."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.health.types import HealthGenerationErrorEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/health_generation_error")
async def health_generation_error_api(
    request: HealthGenerationErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Health generation error.

    Emitted when health resource generation fails.
    """
    return {"success": True}


@internal_sio.on("generate_call_error")  # type: ignore
@internal_sio.on("generate_text_error")  # type: ignore
async def handle_health_error(data: dict[str, Any]) -> None:
    """Handle generate_*_error event - filter by health artifact_type and emit health-specific event."""
    # Filter by artifact_type
    artifact_type = data.get("artifact_type")
    if artifact_type != "health":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    error_message = data.get("error_message") or data.get(
        "message", "An error occurred during health generation"
    )

    resource_type = data.get("resource_type")
    resource_types = data.get("resource_types", [])

    # Emit health-specific error event with all fields from internal event
    event = HealthGenerationErrorEvent(
        artifact_type=artifact_type or "health",
        group_id=data.get("group_id"),
        resource_type=resource_type,
        resource_types=resource_types if resource_types else None,
        resource_id=data.get("resource_id"),
        success=False,
        message=error_message,
        trace_id=data.get("trace_id"),
    )
    await sio.emit(
        "health_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )
