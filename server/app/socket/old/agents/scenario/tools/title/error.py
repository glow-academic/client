"""Handler for scenario_tool_title_error WebSocket event - ONE EVENT PER FILE."""

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


class ScenarioTitleToolErrorPayload(BaseModel):
    """Response indicating an error occurred in title tool."""

    success: bool
    message: str
    trace_id: str


async def _scenario_tool_title_error_impl(
    sid: str,
    data: ScenarioTitleToolErrorPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    # Title tool already emits directly in call.py, so this is a no-op forwarder
    await emit_to_client(
        "scenarios_tools_title_error",
        data,
        room=sid,
    )


@internal_sio.on("scenario_tool_title_error")  # type: ignore
async def scenario_tool_title_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle scenario_tool_title_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=ScenarioTitleToolErrorPayload,
        handler=_scenario_tool_title_error_impl,  # type: ignore[arg-type]
        error_event_name="scenario_tool_title_error",
        error_response_type=ScenarioTitleToolErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/scenario_tool_title_error",
    ScenarioTitleToolErrorPayload,
    "Error occurred in Scenario title tool",
)
