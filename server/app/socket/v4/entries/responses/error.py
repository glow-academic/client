"""Responses entry error handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.entries.responses.types import ResponsesGenerationErrorEvent
from app.socket.v4.entries.utils import resolve_entry_type

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_error(data: dict[str, Any]) -> None:
    """Responses generation error - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    event = ResponsesGenerationErrorEvent(
        artifact_type=data.get("artifact_type", ""),
        group_id=data.get("group_id"),
        run_id=data.get("run_id"),
        message=data.get("message") or data.get("error_message") or "Unknown error",
        error_stage=data.get("error_stage"),
        tool_name=data.get("tool_name"),
        tool_call_id=data.get("tool_call_id"),
        arguments=data.get("arguments"),
    )

    await sio.emit(
        "responses_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )


@internal_sio.on("generate_call_error")
async def responses_call_error_listener(data: dict[str, Any]) -> None:
    """Listen for error events targeting responses."""
    if resolve_entry_type(data) != "responses":
        return
    await handle_error(data)


@server_router.post("/responses_generation_error")
async def responses_generation_error_api(
    request: ResponsesGenerationErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Responses generation error."""
    return {"success": True}
