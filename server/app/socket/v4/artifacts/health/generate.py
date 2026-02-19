"""Health generation router - stub handler for health resource types."""

from typing import Any

from fastapi import APIRouter

from app.main import sio
from app.socket.v4.artifacts.types import HealthGenerationStartedEvent
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


@sio.event  # type: ignore
async def health_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle health_generate event (client-to-server) - stub."""
    logger.info(f"health_generate called for sid={sid}")


@server_router.post("/health_generation_started")
async def health_generation_started_api(
    request: HealthGenerationStartedEvent,
) -> dict[str, bool]:
    """Server-to-client event: Health generation started."""
    return {"success": True}
