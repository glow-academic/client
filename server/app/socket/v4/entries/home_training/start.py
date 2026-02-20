"""Home Training entry start handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.entries.home_training.types import HomeTrainingGenerationEvent
from app.socket.v4.entries.utils import resolve_entry_type

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_start(data: dict[str, Any]) -> None:
    """Home Training generation started - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    event = HomeTrainingGenerationEvent(
        artifact_type=data.get("artifact_type", ""),
        group_id=data.get("group_id", ""),
        run_id=data.get("run_id"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
    )

    await sio.emit(
        "home_training_generation_started",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_start")  # type: ignore
async def home_training_call_start_listener(data: dict[str, Any]) -> None:
    """Listen for tool_call_start events targeting home_training."""
    if data.get("event_type") != "tool_call_start":
        return
    if resolve_entry_type(data) != "home_training":
        return
    await handle_start(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/home_training_generation_started")
async def home_training_generation_started_api(
    request: HomeTrainingGenerationEvent,
) -> dict[str, bool]:
    """Server-to-client event: Home Training generation started."""
    return {"success": True}
