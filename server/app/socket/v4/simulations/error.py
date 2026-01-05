"""Handler for simulation_error WebSocket event - ONE EVENT PER FILE."""

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


class SimulationErrorPayload(BaseModel):
    """Response indicating an error occurred in simulation operation."""

    success: bool
    message: str
    attempt_id: str | None = None
    simulation_id: str | None = None
    operation: str | None = None
    error_type: str | None = None


async def _simulation_error_impl(
    sid: str,
    data: SimulationErrorPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "simulations_error",
        data,
        room=sid,
    )


@internal_sio.on("simulation_error")  # type: ignore
async def simulation_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle simulation_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=SimulationErrorPayload,
        handler=_simulation_error_impl,  # type: ignore[arg-type]
        error_event_name="simulations_error",
        error_response_type=SimulationErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/simulation_error",
    SimulationErrorPayload,
    "Error occurred in simulation operation",
)
