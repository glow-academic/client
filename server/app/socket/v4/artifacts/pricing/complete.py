"""Pricing completion handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio
from app.socket.v4.artifacts.pricing.types import PricingGenerationCompleteEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_pricing_artifact_complete(data: dict[str, Any]) -> None:
    """Handle completion events - filter by pricing artifact_type."""
    if data.get("artifact_type") != "pricing":
        return


@server_router.post("/pricing_generation_complete")
async def pricing_generation_complete_api(
    request: PricingGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Pricing generation completed."""
    return {"success": True}
