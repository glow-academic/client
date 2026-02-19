"""Leaderboard completion handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio
from app.socket.v4.artifacts.leaderboard.types import LeaderboardGenerationCompleteEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_leaderboard_artifact_complete(data: dict[str, Any]) -> None:
    """Handle completion events - filter by leaderboard artifact_type."""
    if data.get("artifact_type") != "leaderboard":
        return


@server_router.post("/leaderboard_generation_complete")
async def leaderboard_generation_complete_api(
    request: LeaderboardGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Leaderboard generation completed."""
    return {"success": True}
