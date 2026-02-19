"""Suite error handler - listens to generate_*_error events and emits suite-specific events."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.suite.types import SuiteGenerationErrorEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/suite_generation_error")
async def suite_generation_error_api(
    request: SuiteGenerationErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Suite generation error.

    Emitted when suite resource generation fails.
    """
    return {"success": True}


@internal_sio.on("generate_call_error")  # type: ignore
@internal_sio.on("generate_text_error")  # type: ignore
async def handle_suite_error(data: dict[str, Any]) -> None:
    """Handle generate_*_error event - filter by suite artifact_type and emit suite-specific event."""
    # Filter by artifact_type
    artifact_type = data.get("artifact_type")
    if artifact_type != "suite":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    error_message = data.get("error_message") or data.get(
        "message", "An error occurred during suite generation"
    )

    resource_type = data.get("resource_type")
    resource_types = data.get("resource_types", [])

    # Emit suite-specific error event with all fields from internal event
    event = SuiteGenerationErrorEvent(
        artifact_type=artifact_type or "suite",
        group_id=data.get("group_id"),
        resource_type=resource_type,
        resource_types=resource_types if resource_types else None,
        resource_id=data.get("resource_id"),
        success=False,
        message=error_message,
        trace_id=data.get("trace_id"),
    )
    await sio.emit(
        "suite_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )
