"""Reports completion handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio
from app.socket.v4.artifacts.reports.types import ReportsGenerationCompleteEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_reports_artifact_complete(data: dict[str, Any]) -> None:
    """Handle completion events - filter by reports artifact_type."""
    if data.get("artifact_type") != "reports":
        return


@server_router.post("/reports_generation_complete")
async def reports_generation_complete_api(
    request: ReportsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Reports generation completed."""
    return {"success": True}
