"""Record generation router - stub handler for record resource types."""

from typing import Any

from fastapi import APIRouter

from app.main import sio
from app.socket.v4.artifacts.types import RecordGenerationStartedEvent
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


@sio.event  # type: ignore
async def record_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle record_generate event (client-to-server) - stub."""
    logger.info(f"record_generate called for sid={sid}")


@server_router.post("/record_generation_started")
async def record_generation_started_api(
    request: RecordGenerationStartedEvent,
) -> dict[str, bool]:
    """Server-to-client event: Record generation started."""
    return {"success": True}
