"""Reports generation router - stub handler for reports resource types."""

from typing import Any

from fastapi import APIRouter

from app.main import sio
from app.socket.v4.artifacts.types import ReportsGenerationStartedEvent
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


@sio.event  # type: ignore
async def reports_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle reports_generate event (client-to-server) - stub."""
    logger.info(f"reports_generate called for sid={sid}")


@server_router.post("/reports_generation_started")
async def reports_generation_started_api(
    request: ReportsGenerationStartedEvent,
) -> dict[str, bool]:
    """Server-to-client event: Reports generation started."""
    return {"success": True}
