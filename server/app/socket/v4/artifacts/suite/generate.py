"""Suite generation router - stub handler for suite resource types."""

from typing import Any

from fastapi import APIRouter

from app.main import sio
from app.socket.v4.artifacts.types import SuiteGenerationStartedEvent
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


@sio.event  # type: ignore
async def suite_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle suite_generate event (client-to-server) - stub."""
    logger.info(f"suite_generate called for sid={sid}")


@server_router.post("/suite_generation_started")
async def suite_generation_started_api(
    request: SuiteGenerationStartedEvent,
) -> dict[str, bool]:
    """Server-to-client event: Suite generation started."""
    return {"success": True}
