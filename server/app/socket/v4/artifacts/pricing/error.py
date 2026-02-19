"""Pricing error handler - listens to generate_*_error events and emits pricing-specific events."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.pricing.types import PricingGenerationErrorEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/pricing_generation_error")
async def pricing_generation_error_api(
    request: PricingGenerationErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Pricing generation error.

    Emitted when pricing resource generation fails.
    """
    return {"success": True}


@internal_sio.on("generate_call_error")  # type: ignore
@internal_sio.on("generate_text_error")  # type: ignore
async def handle_pricing_error(data: dict[str, Any]) -> None:
    """Handle generate_*_error event - filter by pricing artifact_type and emit pricing-specific event."""
    # Filter by artifact_type
    artifact_type = data.get("artifact_type")
    if artifact_type != "pricing":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    error_message = data.get("error_message") or data.get(
        "message", "An error occurred during pricing generation"
    )

    resource_type = data.get("resource_type")
    resource_types = data.get("resource_types", [])

    # Emit pricing-specific error event with all fields from internal event
    event = PricingGenerationErrorEvent(
        artifact_type=artifact_type or "pricing",
        group_id=data.get("group_id"),
        resource_type=resource_type,
        resource_types=resource_types if resource_types else None,
        resource_id=data.get("resource_id"),
        success=False,
        message=error_message,
        trace_id=data.get("trace_id"),
    )
    await sio.emit(
        "pricing_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )
