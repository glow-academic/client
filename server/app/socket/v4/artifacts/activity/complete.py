"""Activity completion handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio
from app.socket.v4.artifacts.activity.types import ActivityGenerationCompleteEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_activity_artifact_complete(data: dict[str, Any]) -> None:
    """Handle completion events - filter by activity artifact_type."""
    if data.get("artifact_type") != "activity":
        return


@server_router.post("/activity_generation_complete")
async def activity_generation_complete_api(
    request: ActivityGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Activity generation completed."""
    return {"success": True}
