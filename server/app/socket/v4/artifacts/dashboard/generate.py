"""Dashboard generation router - stub handler for dashboard resource types."""

from typing import Any

from fastapi import APIRouter

from app.main import sio
from app.socket.v4.artifacts.types import DashboardGenerationStartedEvent
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


@sio.event  # type: ignore
async def dashboard_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle dashboard_generate event (client-to-server) - stub."""
    logger.info(f"dashboard_generate called for sid={sid}")


@server_router.post("/dashboard_generation_started")
async def dashboard_generation_started_api(
    request: DashboardGenerationStartedEvent,
) -> dict[str, bool]:
    """Server-to-client event: Dashboard generation started."""
    return {"success": True}
