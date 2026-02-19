"""Dashboard completion handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio
from app.socket.v4.artifacts.dashboard.types import DashboardGenerationCompleteEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_dashboard_artifact_complete(data: dict[str, Any]) -> None:
    """Handle completion events - filter by dashboard artifact_type."""
    if data.get("artifact_type") != "dashboard":
        return


@server_router.post("/dashboard_generation_complete")
async def dashboard_generation_complete_api(
    request: DashboardGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Dashboard generation completed."""
    return {"success": True}
