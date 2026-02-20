"""Training Department entry start handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.entries.training_department.types import (
    TrainingDepartmentGenerationEvent,
)
from app.socket.v4.entries.utils import resolve_entry_type

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_start(data: dict[str, Any]) -> None:
    """Training Department generation started - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    event = TrainingDepartmentGenerationEvent(
        artifact_type=data.get("artifact_type", ""),
        group_id=data.get("group_id", ""),
        run_id=data.get("run_id"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
    )

    await sio.emit(
        "training_department_generation_started",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_start")  # type: ignore
async def training_department_call_start_listener(data: dict[str, Any]) -> None:
    """Listen for tool_call_start events targeting training_department."""
    if data.get("event_type") != "tool_call_start":
        return
    if resolve_entry_type(data) != "training_department":
        return
    await handle_start(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/training_department_generation_started")
async def training_department_generation_started_api(
    request: TrainingDepartmentGenerationEvent,
) -> dict[str, bool]:
    """Server-to-client event: Training Department generation started."""
    return {"success": True}
