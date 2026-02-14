"""TemperatureLevels resource start handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.resources.temperature_levels.types import TemperatureLevelsGenerationStartedEvent
from app.socket.v4.resources.utils import resolve_resource_type

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_start(data: dict[str, Any]) -> None:
    """TemperatureLevels generation started - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    event = TemperatureLevelsGenerationStartedEvent(
        artifact_type=data.get("artifact_type", ""),
        group_id=data.get("group_id", ""),
        run_id=data.get("run_id"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
    )

    await sio.emit(
        "temperature_levels_generation_started",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_start")  # type: ignore
async def temperature_levels_call_start_listener(data: dict[str, Any]) -> None:
    """Listen for tool_call_start events targeting temperature_levels."""
    if data.get("event_type") != "tool_call_start":
        return
    if resolve_resource_type(data) != "temperature_levels":
        return
    await handle_start(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/temperature_levels_generation_started")
async def temperature_levels_generation_started_api(
    request: TemperatureLevelsGenerationStartedEvent,
) -> dict[str, bool]:
    """Server-to-client event: TemperatureLevels generation started."""
    return {"success": True}
