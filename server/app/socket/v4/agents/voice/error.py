"""Handler for simulation_voice_error WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio

internal_sio = get_internal_sio()
server_router = APIRouter()


class SimulationVoiceErrorPayload(BaseModel):
    """Response indicating an error occurred in Simulation Voice generation."""

    success: bool
    message: str
    attempt_id: str | None = None
    simulation_id: str | None = None
    operation: str | None = None


async def _simulation_voice_error_impl(
    sid: str,
    data: SimulationVoiceErrorPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    # 1. Emit child-specific error (existing behavior)
    await emit_to_client(
        "simulations_voice_error",
        data,
        room=sid,
    )

    # 2. Propagate to simulation error handler if simulation context is present
    if data.attempt_id or data.simulation_id:
        await internal_sio.emit(
            "simulation_error",
            {
                "sid": sid,
                "success": data.success,
                "message": data.message,
                "attempt_id": data.attempt_id,
                "simulation_id": data.simulation_id,
                "operation": data.operation or "voice",
                "error_type": "voice_error",
            },
        )


@internal_sio.on("simulation_voice_error")  # type: ignore
async def simulation_voice_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle simulation_voice_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=SimulationVoiceErrorPayload,
        handler=_simulation_voice_error_impl,  # type: ignore[arg-type]
        error_event_name="simulations_voice_error",
        error_response_type=SimulationVoiceErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/simulation_voice_error",
    SimulationVoiceErrorPayload,
    "Error occurred in Simulation Voice generation",
)
