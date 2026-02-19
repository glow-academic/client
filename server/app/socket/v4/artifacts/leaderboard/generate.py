"""Leaderboard generation router - stub handler for leaderboard resource types."""

from typing import Any

from fastapi import APIRouter

from app.main import sio
from app.socket.v4.artifacts.types import LeaderboardGenerationStartedEvent
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


@sio.event  # type: ignore
async def leaderboard_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle leaderboard_generate event (client-to-server) - stub."""
    logger.info(f"leaderboard_generate called for sid={sid}")


@server_router.post("/leaderboard_generation_started")
async def leaderboard_generation_started_api(
    request: LeaderboardGenerationStartedEvent,
) -> dict[str, bool]:
    """Server-to-client event: Leaderboard generation started."""
    return {"success": True}
