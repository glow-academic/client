"""SimulationMessages entry completion handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.entries.simulation_messages.types import (
    SimulationMessagesGenerationEvent,
)
from app.socket.v4.entries.utils import resolve_entry_type

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_complete(data: dict[str, Any]) -> None:
    """Handle simulation_messages generation complete - emit typed event from tool result."""
    sid = data.get("sid", "")
    if not sid:
        return

    tool_result = data.get("result") or {}
    entry_id_str = tool_result.get("entry_id")
    entry_data = tool_result.get("entry_data") or {}

    event = SimulationMessagesGenerationEvent(
        artifact_type=data.get("artifact_type", ""),
        entry_id=entry_id_str,
        group_id=data.get("group_id", ""),
        run_id=data.get("run_id"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
        success=True,
        **entry_data,
    )

    await sio.emit(
        "simulation_messages_generation_complete",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_complete")  # type: ignore
async def simulation_messages_call_complete_listener(data: dict[str, Any]) -> None:
    """Listen for tool_result events targeting simulation_messages."""
    if data.get("event_type") != "tool_result":
        return
    if resolve_entry_type(data) != "simulation_messages":
        return
    await handle_complete(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/simulation_messages_generation_complete")
async def simulation_messages_generation_complete_api(
    request: SimulationMessagesGenerationEvent,
) -> dict[str, bool]:
    """Server-to-client event: SimulationMessages generation completed."""
    return {"success": True}
