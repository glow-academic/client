"""Attempt Message Tree entry error handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.entries.attempt_message_tree.types import (
    AttemptMessageTreeGenerationEvent,
)
from app.socket.v4.entries.utils import resolve_entry_type

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_error(data: dict[str, Any]) -> None:
    """Attempt Message Tree generation error - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    resolved_fields = data.get("resolved_fields") or {}

    event = AttemptMessageTreeGenerationEvent(
        artifact_type=data.get("artifact_type", ""),
        group_id=data.get("group_id"),
        run_id=data.get("run_id"),
        success=False,
        message=data.get("message") or data.get("error_message") or "Unknown error",
        error_stage=data.get("error_stage"),
        tool_name=data.get("tool_name"),
        tool_call_id=data.get("tool_call_id"),
        **resolved_fields,
    )

    await sio.emit(
        "attempt_message_tree_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_error")  # type: ignore
async def attempt_message_tree_call_error_listener(data: dict[str, Any]) -> None:
    """Listen for error events targeting attempt_message_tree."""
    if resolve_entry_type(data) != "attempt_message_tree":
        return
    await handle_error(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/attempt_message_tree_generation_error")
async def attempt_message_tree_generation_error_api(
    request: AttemptMessageTreeGenerationEvent,
) -> dict[str, bool]:
    """Server-to-client event: Attempt Message Tree generation error."""
    return {"success": True}
