"""SimulationAvailability resource completion handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.resources.simulation_availability.types import (
    SimulationAvailabilityGenerationEvent,
)
from app.socket.v4.resources.utils import resolve_resource_type

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_complete(data: dict[str, Any]) -> None:
    """Handle simulation_availability generation complete - emit typed event from tool result."""
    sid = data.get("sid", "")
    group_id_str = data.get("group_id", "")
    run_id = data.get("run_id")
    tool_result = data.get("result") or {}
    resource_id_str = tool_result.get("resource_id")
    resource_data = tool_result.get("resource_data") or {}

    if not sid or not resource_id_str:
        return

    event = SimulationAvailabilityGenerationEvent(
        artifact_type=data.get("artifact_type", ""),
        resource_id=resource_id_str,
        group_id=group_id_str,
        run_id=run_id,
        success=True,
        **resource_data,
    )

    await sio.emit(
        "simulation_availability_generation_complete",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_complete")  # type: ignore
async def simulation_availability_call_complete_listener(data: dict[str, Any]) -> None:
    """Listen for tool_result events targeting simulation_availability."""
    if data.get("event_type") != "tool_result":
        return
    if resolve_resource_type(data) != "simulation_availability":
        return
    await handle_complete(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/simulation_availability_generation_complete")
async def simulation_availability_generation_complete_api(
    request: SimulationAvailabilityGenerationEvent,
) -> dict[str, bool]:
    """Server-to-client event: SimulationAvailability generation completed."""
    return {"success": True}
