"""Session generation router - stub handler for session resource types."""

from typing import Any

from fastapi import APIRouter

from app.main import sio
from app.socket.v4.artifacts.types import SessionGenerationStartedEvent
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


@sio.event  # type: ignore
async def session_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle session_generate event (client-to-server) - stub."""
    logger.info(f"session_generate called for sid={sid}")


@server_router.post("/session_generation_started")
async def session_generation_started_api(
    request: SessionGenerationStartedEvent,
) -> dict[str, bool]:
    """Server-to-client event: Session generation started."""
    return {"success": True}
