"""Handler for simulation_text_progress internal event - dispatches to tool-specific handlers."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for internal events
class SimulationTextProgressPayload(BaseModel):
    """Generic simulation progress event - dispatches to tool-specific handlers."""

    sid: str
    type: str  # "tool_call_start" | "message_token" | "tool_call_progress"
    chat_id: str
    run_id: str
    tool_call_id: str | None = None
    call_id: str | None = None
    tool_name: str | None = None
    token: str | None = None
    accumulated_content: str | None = None
    arguments_raw: str | None = None
    persona_so_far: str | None = None
    parent_message_id: str | None = None


class SimulationTextProgressErrorPayload(BaseModel):
    """Response indicating an error occurred in simulation text progress."""

    success: bool
    message: str


async def _simulation_text_progress_impl(
    sid: str,
    data: SimulationTextProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Dispatch to tool-specific progress handler."""
    # Route to appropriate tool handler based on tool_name (only speak for simulation agent)
    if data.type == "tool_call_start":
        # Emit tool-specific start event
        if data.tool_name == "speak":
            await internal_sio.emit(
                "simulation_speak_progress",
                {
                    "sid": data.sid,
                    "type": "tool_call_start",
                    "chat_id": data.chat_id,
                    "run_id": data.run_id,
                    "tool_call_id": data.tool_call_id or "",
                    "call_id": data.call_id,
                    "arguments_raw": data.arguments_raw or "",
                    "parent_message_id": data.parent_message_id,
                },
            )

    elif data.type == "message_token" or data.type == "tool_call_progress":
        # Emit tool-specific progress event
        if data.tool_name == "speak":
            await internal_sio.emit(
                "simulation_speak_progress",
                {
                    "sid": data.sid,
                    "type": "tool_call_progress",
                    "chat_id": data.chat_id,
                    "run_id": data.run_id,
                    "tool_call_id": data.tool_call_id or "",
                    "call_id": data.call_id,
                    "tool_name": data.tool_name,
                    "token": data.token,
                    "accumulated_content": data.accumulated_content,
                    "arguments_raw": data.arguments_raw or "",
                    "persona_so_far": data.persona_so_far,
                    "parent_message_id": data.parent_message_id,
                },
            )


@internal_sio.on("simulation_text_progress")  # type: ignore
async def simulation_text_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle simulation_text_progress event from internal bus."""
    # Only handle tool-related types
    if data.get("type") in ("tool_call_start", "message_token", "tool_call_progress"):
        await handle_internal_event(
            data=data,
            request_type=SimulationTextProgressPayload,
            handler=_simulation_text_progress_impl,  # type: ignore[arg-type]
            error_event_name="simulation_text_error",
            error_response_type=SimulationTextProgressErrorPayload,
        )


register_server_endpoint(
    server_router,
    "/simulation_text_progress",
    SimulationTextProgressPayload,
    "Dispatch simulation progress to tool-specific handlers",
)
