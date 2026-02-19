"""Suite completion handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio
from app.socket.v4.artifacts.suite.types import SuiteGenerationCompleteEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_suite_artifact_complete(data: dict[str, Any]) -> None:
    """Handle completion events - filter by suite artifact_type."""
    if data.get("artifact_type") != "suite":
        return


@server_router.post("/suite_generation_complete")
async def suite_generation_complete_api(
    request: SuiteGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Suite generation completed."""
    return {"success": True}
