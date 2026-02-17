"""Highlights entry progress handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.entries.highlights.types import HighlightsGenerationEvent
from app.socket.v4.entries.utils import resolve_entry_type

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_progress(data: dict[str, Any]) -> None:
    """Highlights generation progress - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    resolved_fields = data.get("resolved_fields") or {}

    event = HighlightsGenerationEvent(
        artifact_type=data.get("artifact_type", ""),
        group_id=data.get("group_id"),
        run_id=data.get("run_id"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
        arguments_delta=data.get("arguments_delta"),
        **resolved_fields,
    )

    await sio.emit(
        "highlights_generation_progress",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_progress")  # type: ignore
async def highlights_call_progress_listener(data: dict[str, Any]) -> None:
    """Listen for tool_call_delta events targeting highlights."""
    if data.get("event_type") != "tool_call_delta":
        return
    if resolve_entry_type(data) != "highlights":
        return
    await handle_progress(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/highlights_generation_progress")
async def highlights_generation_progress_api(
    request: HighlightsGenerationEvent,
) -> dict[str, bool]:
    """Server-to-client event: Highlights generation progress."""
    return {"success": True}
