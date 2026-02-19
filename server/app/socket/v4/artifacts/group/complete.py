"""Group completion handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio
from app.socket.v4.artifacts.group.types import GroupGenerationCompleteEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_group_artifact_complete(data: dict[str, Any]) -> None:
    """Handle completion events - filter by group artifact_type."""
    if data.get("artifact_type") != "group":
        return


@server_router.post("/group_generation_complete")
async def group_generation_complete_api(
    request: GroupGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Group generation completed."""
    return {"success": True}
