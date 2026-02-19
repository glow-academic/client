"""Pricing generation router - stub handler for pricing resource types."""

from typing import Any

from fastapi import APIRouter

from app.main import sio
from app.socket.v4.artifacts.types import PricingGenerationStartedEvent
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


@sio.event  # type: ignore
async def pricing_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle pricing_generate event (client-to-server) - stub."""
    logger.info(f"pricing_generate called for sid={sid}")


@server_router.post("/pricing_generation_started")
async def pricing_generation_started_api(
    request: PricingGenerationStartedEvent,
) -> dict[str, bool]:
    """Server-to-client event: Pricing generation started."""
    return {"success": True}
