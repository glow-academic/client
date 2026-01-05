"""Handler for scenario_progress WebSocket event - dispatches to tool-specific handlers."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio

internal_sio = get_internal_sio()

server_router = APIRouter()


class ScenarioProgressPayload(BaseModel):
    """Generic scenario progress event - dispatches to tool-specific handlers."""

    sid: str
    type: str  # "tool_call_start" | "tool_call_progress"
    scenario_id: str | None = None
    run_id: str
    tool_name: str
    tool_call_id: str
    call_id: str | None = None
    arguments_raw: str


class ScenarioProgressErrorPayload(BaseModel):
    """Error response for scenario progress."""

    success: bool
    message: str


# Map tool names to event names
TOOL_EVENT_MAP = {
    "create_statement": "scenario_statement",
    "create_title": "scenario_title",
    "set_objectives": "scenario_objective",
    "create_document": "scenario_document",
    "create_video": "scenario_video",
    "create_question": "scenario_question",
    "create_image": "scenario_image",
}


async def _scenario_progress_impl(
    sid: str,
    data: ScenarioProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Dispatch to tool-specific progress handler."""
    # Route to appropriate tool handler based on tool_name
    tool_event_name = TOOL_EVENT_MAP.get(data.tool_name)

    if not tool_event_name:
        # Unknown tool - skip dispatch
        return

    if data.type == "tool_call_start":
        # Emit tool-specific start event
        await internal_sio.emit(
            f"{tool_event_name}_progress",
            {
                "sid": data.sid,
                "type": "tool_call_start",
                "scenario_id": data.scenario_id,
                "run_id": data.run_id,
                "tool_call_id": data.tool_call_id,
                "call_id": data.call_id,
                "tool_name": data.tool_name,
                "arguments_raw": data.arguments_raw,
            },
        )

    elif data.type == "tool_call_progress":
        # Emit tool-specific progress event
        await internal_sio.emit(
            f"{tool_event_name}_progress",
            {
                "sid": data.sid,
                "type": "tool_call_progress",
                "scenario_id": data.scenario_id,
                "run_id": data.run_id,
                "tool_call_id": data.tool_call_id,
                "call_id": data.call_id,
                "tool_name": data.tool_name,
                "arguments_raw": data.arguments_raw,
            },
        )


@internal_sio.on("scenario_progress")  # type: ignore
async def scenario_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle scenario_progress event from internal bus."""
    # Only handle tool-related types
    if data.get("type") in ("tool_call_start", "tool_call_progress"):
        await handle_internal_event(
            data=data,
            request_type=ScenarioProgressPayload,
            handler=_scenario_progress_impl,  # type: ignore[arg-type]
            error_event_name="scenario_progress_error",
            error_response_type=ScenarioProgressErrorPayload,
        )


register_server_endpoint(
    server_router,
    "/scenario_progress",
    ScenarioProgressPayload,
    "Dispatch scenario progress to tool-specific handlers",
)
