"""Session completion handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio
from app.socket.v4.artifacts.session.types import SessionGenerationCompleteEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_session_artifact_complete(data: dict[str, Any]) -> None:
    """Handle completion events - filter by session artifact_type."""
    if data.get("artifact_type") != "session":
        return


@server_router.post("/session_generation_complete")
async def session_generation_complete_api(
    request: SessionGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Session generation completed."""
    return {"success": True}
