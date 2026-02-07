"""Field error handler - listens to generate_*_error events and emits field-specific events."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.field.types import FieldGenerationErrorEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/field_generation_error")
async def field_generation_error_api(
    request: FieldGenerationErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Field generation error.

    Emitted when field resource generation fails.
    """
    return {"success": True}


@internal_sio.on("generate_call_error")  # type: ignore
@internal_sio.on("generate_text_error")  # type: ignore
async def handle_field_generation_error(data: dict[str, Any]) -> None:
    """Handle generate_*_error event - filter by field artifact_type and emit field-specific event."""
    artifact_type = data.get("artifact_type")
    if artifact_type != "field":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    error_message = data.get("error_message") or data.get(
        "message", "An error occurred during field generation"
    )

    event = FieldGenerationErrorEvent(
        artifact_type=artifact_type or "field",
        group_id=data.get("group_id"),
        resource_type=data.get("resource_type"),
        resource_types=data.get("resource_types") or None,
        resource_id=data.get("resource_id"),
        success=False,
        message=error_message,
        trace_id=data.get("trace_id"),
    )
    await sio.emit(
        "field_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )
