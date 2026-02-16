"""ScenarioPersonas resource error handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.resources.scenario_personas.types import (
    ScenarioPersonasGenerationEvent,
)
from app.socket.v4.resources.utils import resolve_resource_type

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_error(data: dict[str, Any]) -> None:
    """ScenarioPersonas generation error - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    resolved_fields = data.get("resolved_fields") or {}

    event = ScenarioPersonasGenerationEvent(
        artifact_type=data.get("artifact_type", ""),
        group_id=data.get("group_id"),
        run_id=data.get("run_id"),
        message=data.get("message") or data.get("error_message") or "Unknown error",
        error_stage=data.get("error_stage"),
        tool_name=data.get("tool_name"),
        tool_call_id=data.get("tool_call_id"),
        **resolved_fields,
    )

    await sio.emit(
        "scenario_personas_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_error")  # type: ignore
async def scenario_personas_call_error_listener(data: dict[str, Any]) -> None:
    """Listen for error events targeting scenario_personas."""
    if resolve_resource_type(data) != "scenario_personas":
        return
    await handle_error(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/scenario_personas_generation_error")
async def scenario_personas_generation_error_api(
    request: ScenarioPersonasGenerationEvent,
) -> dict[str, bool]:
    """Server-to-client event: ScenarioPersonas generation error."""
    return {"success": True}
