"""Home error handler - listens to generate_call_error and emits home-specific error events."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.home.types import HomeGenerationErrorEvent
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_error")  # type: ignore
async def handle_home_error(data: dict[str, Any]) -> None:
    """Handle generate_call_error event - filter by home artifact_type and emit home-specific event."""
    if data.get("artifact_type") != "home":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    error_message = data.get("error_message") or data.get(
        "message", "An error occurred during home generation"
    )

    await sio.emit(
        "home_generation_error",
        {
            "artifact_type": "home",
            "resource_type": data.get("resource_type"),
            "resource_types": data.get("resource_types") or None,
            "resource_id": data.get("resource_id"),
            "group_id": data.get("group_id"),
            "success": False,
            "message": error_message,
            "trace_id": data.get("trace_id"),
        },
        room=sid,
    )


@server_router.post("/home_generation_error")
async def home_generation_error_api(
    request: HomeGenerationErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: home generation error."""
    _ = request
    return {"ok": True}
