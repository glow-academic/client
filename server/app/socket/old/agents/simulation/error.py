"""Handler for simulation_text_error WebSocket event - ONE EVENT PER FILE."""

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


class SimulationTextErrorPayload(BaseModel):
    """Response indicating an error occurred in Simulation Text generation."""

    success: bool
    message: str
    attempt_id: str | None = None
    simulation_id: str | None = None
    operation: str | None = None


async def _simulation_text_error_impl(
    sid: str,
    data: SimulationTextErrorPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    # 1. Emit child-specific error (existing behavior)
    await emit_to_client(
        "simulations_text_error",
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
                "operation": data.operation or "text_generation",
                "error_type": "text_generation_error",
            },
        )


@internal_sio.on("simulation_text_error")  # type: ignore
async def simulation_text_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle simulation_text_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=SimulationTextErrorPayload,
        handler=_simulation_text_error_impl,  # type: ignore[arg-type]
        error_event_name="simulations_text_error",
        error_response_type=SimulationTextErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/simulation_text_error",
    SimulationTextErrorPayload,
    "Error occurred in Simulation Text generation",
)
