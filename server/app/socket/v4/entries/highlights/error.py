"""Highlights entry error handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.entries.highlights.types import HighlightsGenerationEvent
from app.socket.v4.entries.utils import resolve_entry_type

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_error(data: dict[str, Any]) -> None:
    """Highlights generation error - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    resolved_fields = data.get("resolved_fields") or {}

    event = HighlightsGenerationEvent(
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
        "highlights_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_error")  # type: ignore
async def highlights_call_error_listener(data: dict[str, Any]) -> None:
    """Listen for error events targeting highlights."""
    if resolve_entry_type(data) != "highlights":
        return
    await handle_error(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/highlights_generation_error")
async def highlights_generation_error_api(
    request: HighlightsGenerationEvent,
) -> dict[str, bool]:
    """Server-to-client event: Highlights generation error."""
    return {"success": True}
