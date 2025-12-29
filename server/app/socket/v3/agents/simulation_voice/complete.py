"""Handler for simulation_voice_complete WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio

internal_sio = get_internal_sio()
server_router = APIRouter()


class SimulationVoiceCompletePayload(BaseModel):
    """Response indicating Simulation Voice generation completed successfully."""

    success: bool
    message: str | None = None


class SimulationVoiceErrorPayload(BaseModel):
    """Response indicating an error occurred in Simulation Voice generation."""

    success: bool
    message: str


async def _simulation_voice_complete_impl(
    sid: str,
    data: SimulationVoiceCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "simulations_voice_complete",
        data,
        room=sid,
    )


@internal_sio.on("simulation_voice_complete")  # type: ignore
async def simulation_voice_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle simulation_voice_complete event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=SimulationVoiceCompletePayload,
        handler=_simulation_voice_complete_impl,  # type: ignore[arg-type]
        error_event_name="simulations_voice_error",
        error_response_type=SimulationVoiceErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/simulation_voice_complete",
    SimulationVoiceCompletePayload,
    "Simulation Voice generation completed successfully",
)
