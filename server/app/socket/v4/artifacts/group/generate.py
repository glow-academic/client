"""Group generation router - stub handler for group resource types."""

from typing import Any

from fastapi import APIRouter

from app.main import sio
from app.socket.v4.artifacts.types import GroupGenerationStartedEvent
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


@sio.event  # type: ignore
async def group_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle group_generate event (client-to-server) - stub."""
    logger.info(f"group_generate called for sid={sid}")


@server_router.post("/group_generation_started")
async def group_generation_started_api(
    request: GroupGenerationStartedEvent,
) -> dict[str, bool]:
    """Server-to-client event: Group generation started."""
    return {"success": True}
