"""Pricing resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.pricing.types import PricingGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/pricing_generation_complete")
async def pricing_generation_complete_api(
    request: PricingGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Pricing generation completed."""
    return {"success": True}


@server_router.post("/pricing_generation_started")
async def pricing_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Pricing generation started."""
    return {"success": True}


@server_router.post("/pricing_generation_progress")
async def pricing_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Pricing generation progress."""
    return {"success": True}


@server_router.post("/pricing_generation_error")
async def pricing_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Pricing generation error."""
    return {"success": True}
