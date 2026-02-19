"""Leaderboard error handler - listens to generate_*_error events and emits leaderboard-specific events."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.leaderboard.types import LeaderboardGenerationErrorEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/leaderboard_generation_error")
async def leaderboard_generation_error_api(
    request: LeaderboardGenerationErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Leaderboard generation error.

    Emitted when leaderboard resource generation fails.
    """
    return {"success": True}


@internal_sio.on("generate_call_error")  # type: ignore
@internal_sio.on("generate_text_error")  # type: ignore
async def handle_leaderboard_error(data: dict[str, Any]) -> None:
    """Handle generate_*_error event - filter by leaderboard artifact_type and emit leaderboard-specific event."""
    # Filter by artifact_type
    artifact_type = data.get("artifact_type")
    if artifact_type != "leaderboard":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    error_message = data.get("error_message") or data.get(
        "message", "An error occurred during leaderboard generation"
    )

    resource_type = data.get("resource_type")
    resource_types = data.get("resource_types", [])

    # Emit leaderboard-specific error event with all fields from internal event
    event = LeaderboardGenerationErrorEvent(
        artifact_type=artifact_type or "leaderboard",
        group_id=data.get("group_id"),
        resource_type=resource_type,
        resource_types=resource_types if resource_types else None,
        resource_id=data.get("resource_id"),
        success=False,
        message=error_message,
        trace_id=data.get("trace_id"),
    )
    await sio.emit(
        "leaderboard_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )
