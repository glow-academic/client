"""Home Insights entry start handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.entries.home_insights.types import HomeInsightsGenerationEvent
from app.socket.v4.entries.utils import resolve_entry_type

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_start(data: dict[str, Any]) -> None:
    """Home Insights generation started - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    event = HomeInsightsGenerationEvent(
        artifact_type=data.get("artifact_type", ""),
        group_id=data.get("group_id", ""),
        run_id=data.get("run_id"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
    )

    await sio.emit(
        "home_insights_generation_started",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_start")  # type: ignore
async def home_insights_call_start_listener(data: dict[str, Any]) -> None:
    """Listen for tool_call_start events targeting home_insights."""
    if data.get("event_type") != "tool_call_start":
        return
    if resolve_entry_type(data) != "home_insights":
        return
    await handle_start(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/home_insights_generation_started")
async def home_insights_generation_started_api(
    request: HomeInsightsGenerationEvent,
) -> dict[str, bool]:
    """Server-to-client event: Home Insights generation started."""
    return {"success": True}
