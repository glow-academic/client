"""Health completion handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio
from app.socket.v4.artifacts.health.types import HealthGenerationCompleteEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_health_artifact_complete(data: dict[str, Any]) -> None:
    """Handle completion events - filter by health artifact_type."""
    if data.get("artifact_type") != "health":
        return


@server_router.post("/health_generation_complete")
async def health_generation_complete_api(
    request: HealthGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Health generation completed."""
    return {"success": True}
