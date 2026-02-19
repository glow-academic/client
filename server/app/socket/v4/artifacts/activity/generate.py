"""Activity generation router - stub handler for activity resource types."""

from typing import Any

from fastapi import APIRouter

from app.main import sio
from app.socket.v4.artifacts.types import ActivityGenerationStartedEvent
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


@sio.event  # type: ignore
async def activity_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle activity_generate event (client-to-server) - stub."""
    logger.info(f"activity_generate called for sid={sid}")


@server_router.post("/activity_generation_started")
async def activity_generation_started_api(
    request: ActivityGenerationStartedEvent,
) -> dict[str, bool]:
    """Server-to-client event: Activity generation started."""
    return {"success": True}
