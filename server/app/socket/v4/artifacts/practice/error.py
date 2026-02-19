"""Practice error handler - listens to generate_call_error and emits practice-specific error events."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.practice.types import PracticeGenerationErrorEvent
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_error")  # type: ignore
async def handle_practice_error(data: dict[str, Any]) -> None:
    """Handle generate_call_error event - filter by practice artifact_type and emit practice-specific event."""
    if data.get("artifact_type") != "practice":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    error_message = data.get("error_message") or data.get(
        "message", "An error occurred during practice generation"
    )

    await sio.emit(
        "practice_generation_error",
        {
            "artifact_type": "practice",
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


@server_router.post("/practice_generation_error")
async def practice_generation_error_api(
    request: PracticeGenerationErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: practice generation error."""
    _ = request
    return {"ok": True}
