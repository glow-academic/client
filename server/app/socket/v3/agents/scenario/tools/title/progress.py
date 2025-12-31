"""Handler for scenario_tool_title_progress WebSocket event - ONE EVENT PER FILE."""

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


class ScenarioTitleProgressPayload(BaseModel):
    """Response indicating progress in Scenario Title tool."""

    type: str
    message: str | None = None


class ScenarioTitleToolErrorPayload(BaseModel):
    """Response indicating an error occurred in Scenario Title tool."""

    success: bool
    message: str
    trace_id: str


async def _scenario_tool_title_progress_impl(
    sid: str,
    data: ScenarioTitleProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "scenarios_tools_title_progress",
        data,
        room=sid,
    )


@internal_sio.on("scenario_tool_title_progress")  # type: ignore
async def scenario_tool_title_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle scenario_tool_title_progress event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=ScenarioTitleProgressPayload,
        handler=_scenario_tool_title_progress_impl,  # type: ignore[arg-type]
        error_event_name="scenario_tool_title_error",
        error_response_type=ScenarioTitleToolErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/scenario_tool_title_progress",
    ScenarioTitleProgressPayload,
    "Progress update for Scenario Title tool",
)
