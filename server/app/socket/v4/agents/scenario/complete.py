"""Handler for scenario_complete WebSocket event - dispatches to tool-specific handlers and tracks overall completion."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

server_router = APIRouter()


class ScenarioCompletePayload(BaseModel):
    """Generic scenario complete event - dispatches to tool-specific handlers."""

    sid: str
    type: str  # "tool_call_complete" | "run_complete"
    scenario_id: str | None = None
    run_id: str
    tool_name: str | None = None
    tool_call_id: str | None = None
    call_id: str | None = None
    final_content: str | None = None
    arguments_raw: str | None = None
    message: str | None = None
    trace_id: str | None = None


class ScenarioCompleteErrorPayload(BaseModel):
    """Error response for scenario complete."""

    success: bool
    message: str


class ScenarioGenerateCompletePayload(BaseModel):
    """Payload for scenario_generate_complete client event."""

    success: bool
    scenario_id: str | None = None
    message: str | None = None
    trace_id: str | None = None


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


async def _scenario_complete_impl(
    sid: str,
    data: ScenarioCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Dispatch to tool-specific complete handler."""
    if data.type == "tool_call_complete":
        # Route to appropriate tool handler
        if data.tool_name:
            tool_event_name = TOOL_EVENT_MAP.get(data.tool_name)
            if tool_event_name:
                await internal_sio.emit(
                    f"{tool_event_name}_complete",
                    {
                        "sid": data.sid,
                        "scenario_id": data.scenario_id,
                        "run_id": data.run_id,
                        "tool_call_id": data.tool_call_id or "",
                        "call_id": data.call_id,
                        "tool_name": data.tool_name,
                        "final_content": data.final_content or "",
                        "arguments_raw": data.arguments_raw or "",
                    },
                )

    elif data.type == "run_complete":
        # All tools done - emit overall completion
        await sio.emit(
            "scenarios_generation_complete",
            ScenarioGenerateCompletePayload(
                success=True,
                scenario_id=data.scenario_id,
                message=data.message
                or "Scenario generation completed. Check tool completion events for created resources.",
                trace_id=data.trace_id,
            ).model_dump(),
            room=sid,
        )


@internal_sio.on("scenario_complete")  # type: ignore
async def scenario_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle scenario_complete event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=ScenarioCompletePayload,
        handler=_scenario_complete_impl,  # type: ignore[arg-type]
        error_event_name="scenario_complete_error",
        error_response_type=ScenarioCompleteErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/scenario_complete",
    ScenarioCompletePayload,
    "Dispatch scenario complete to tool-specific handlers",
)
