"""Handler for prompt_regenerate WebSocket event - regenerates prompts and instructions."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import get_internal_sio, sio

# Types will be auto-generated from SQL introspection
try:
    from app.sql.types import (
        GetPromptRegenerationRunContextAndCreateRunSqlParams,
        GetPromptRegenerationRunContextAndCreateRunSqlRow,
        GetSimulationMessagesSqlParams,
        GetSimulationMessagesSqlRow,
    )
except ImportError:
    from pydantic import BaseModel

    class GetPromptRegenerationRunContextAndCreateRunSqlParams(BaseModel):
        chat_id: uuid.UUID
        profile_id: uuid.UUID
        group_id: uuid.UUID
        user_instructions: str | None = None

    class GetPromptRegenerationRunContextAndCreateRunSqlRow(BaseModel):
        chat_id: str
        chat_title: str
        trace_id: str
        attempt_id: str
        simulation_id: str
        scenario_id: str
        department_id: str
        system_prompt: str
        temperature: float
        reasoning: str
        model_id: str
        model_name: str
        provider: str
        base_url: str
        api_key: str
        custom_model: str | None
        provider_id: str | None
        provider_name: str
        agent_id: str
        profile_id: str
        req_per_day: int
        runs_today_count: int
        earliest_run_created_at: str | None
        run_id: str
        group_id: uuid.UUID
        previous_messages: list[Any] | None = None

    class GetSimulationMessagesSqlParams(BaseModel):
        chat_id: uuid.UUID

    class GetSimulationMessagesSqlRow(BaseModel):
        messages: list[Any] | None = None


internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH_CONTEXT = (
    "app/sql/v4/prompt/get_prompt_regeneration_run_context_and_create_run_complete.sql"
)
SQL_PATH_MESSAGES = "app/sql/v4/simulations/get_simulation_messages_complete.sql"


# Pydantic models
class PromptRegeneratePayload(BaseModel):
    """Request to regenerate prompt agent response."""

    chat_id: str
    group_id: str  # REQUIRED for regeneration
    user_instructions: str | None = None


class PromptRegenerateErrorPayload(BaseModel):
    """Response indicating an error occurred in prompt regeneration."""

    success: bool
    message: str


# Emit helper functions
async def prompt_regenerate_error(
    payload: PromptRegenerateErrorPayload, room: str
) -> None:
    await sio.emit("prompt_regenerate_error", payload.model_dump(), room=room)


async def _prompt_regenerate_impl(
    sid: str,
    data: PromptRegeneratePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle prompt_regenerate internal event - regenerates agent response."""
    # TODO: Implement regeneration logic similar to member agent
    # For now, placeholder that emits error
    await internal_sio.emit(
        "prompt_regenerate_error",
        {
            "sid": sid,
            "success": False,
            "message": "Prompt agent regeneration not yet implemented",
        },
    )


@sio.event  # type: ignore
async def prompt_regenerate(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""

    profile_id = await find_profile_by_socket(sid)
    if not profile_id:
        await prompt_regenerate_error(
            PromptRegenerateErrorPayload(
                success=False, message="Profile not found for socket"
            ),
            room=sid,
        )
        return

    try:
        validated = PromptRegeneratePayload(**data)
    except ValidationError as e:
        await prompt_regenerate_error(
            PromptRegenerateErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )
        return

    group_id = uuid.UUID(validated.group_id) if validated.group_id else None

    await _prompt_regenerate_impl(sid, validated, profile_id, group_id)


@internal_sio.on("prompt_regenerate")  # type: ignore
async def prompt_regenerate_internal(data: dict[str, Any]) -> None:
    """Handle prompt_regenerate event from internal bus (server-to-server)."""
    from app.infra.v4.websocket.handler_wrapper import handle_internal_event

    await handle_internal_event(
        data=data,
        request_type=PromptRegeneratePayload,
        handler=_prompt_regenerate_impl,  # type: ignore[arg-type]
        error_event_name="prompt_regenerate_error",
        error_response_type=PromptRegenerateErrorPayload,
    )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/regenerate", response_model=dict[str, bool])
async def prompt_regenerate_api(
    request: PromptRegeneratePayload,
) -> dict[str, bool]:
    """Client-to-server event: Regenerate prompt agent response."""
    return {"success": True}


@server_router.post("/regenerate_error", response_model=dict[str, bool])
async def prompt_regenerate_error_api(
    request: PromptRegenerateErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred in prompt regeneration."""
    return {"success": True}


from app.infra.v4.websocket.openapi_helpers import register_server_endpoint

register_server_endpoint(
    client_router,
    "/regenerate",
    PromptRegeneratePayload,
    "Regenerate prompt agent response",
)
