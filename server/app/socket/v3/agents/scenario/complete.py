"""Handler for scenario_complete WebSocket event - ONE EVENT PER FILE."""

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


class ScenarioCompletePayload(BaseModel):
    """Response indicating scenario generation completed successfully."""

    success: bool
    scenario_id: str | None = None
    message: str | None = None


class ScenarioErrorPayload(BaseModel):
    """Response indicating an error occurred in scenario generation."""

    success: bool
    message: str


async def _scenario_complete_impl(
    sid: str,
    data: ScenarioCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "scenarios_generation_complete",
        data,
        room=sid,
    )


@internal_sio.on("scenario_complete")  # type: ignore
async def scenario_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle scenario_complete event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=ScenarioCompletePayload,
        handler=_scenario_complete_impl,  # type: ignore[arg-type]
        error_event_name="scenarios_generation_error",
        error_response_type=ScenarioErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/scenario_complete",
    ScenarioCompletePayload,
    "Scenario generation completed successfully",
)
