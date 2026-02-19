"""Record completion handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio
from app.socket.v4.artifacts.record.types import RecordGenerationCompleteEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_record_artifact_complete(data: dict[str, Any]) -> None:
    """Handle completion events - filter by record artifact_type."""
    if data.get("artifact_type") != "record":
        return


@server_router.post("/record_generation_complete")
async def record_generation_complete_api(
    request: RecordGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Record generation completed."""
    return {"success": True}
