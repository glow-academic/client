"""Handler for simulation_text_progress WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio
from fastapi import APIRouter
from pydantic import BaseModel

internal_sio = get_internal_sio()
server_router = APIRouter()


class SimulationTextProgressPayload(BaseModel):
    """Response indicating progress in Simulation Text generation."""

    type: str
    message: str | None = None


class SimulationTextErrorPayload(BaseModel):
    """Response indicating an error occurred in Simulation Text generation."""

    success: bool
    message: str


async def _simulation_text_progress_impl(
    sid: str,
    data: SimulationTextProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "simulations_text_progress",
        data,
        room=sid,
    )


@internal_sio.on("simulation_text_progress")  # type: ignore
async def simulation_text_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle simulation_text_progress event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=SimulationTextProgressPayload,
        handler=_simulation_text_progress_impl,  # type: ignore[arg-type]
        error_event_name="simulations_text_error",
        error_response_type=SimulationTextErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/simulation_text_progress",
    SimulationTextProgressPayload,
    "Progress update for Simulation Text generation",
)
