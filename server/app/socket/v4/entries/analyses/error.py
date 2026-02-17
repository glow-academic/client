"""Analyses entry error handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.entries.analyses.types import AnalysesGenerationEvent
from app.socket.v4.entries.utils import resolve_entry_type

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_error(data: dict[str, Any]) -> None:
    """Analyses generation error - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    resolved_fields = data.get("resolved_fields") or {}

    event = AnalysesGenerationEvent(
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
        "analyses_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_error")  # type: ignore
async def analyses_call_error_listener(data: dict[str, Any]) -> None:
    """Listen for error events targeting analyses."""
    if resolve_entry_type(data) != "analyses":
        return
    await handle_error(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/analyses_generation_error")
async def analyses_generation_error_api(
    request: AnalysesGenerationEvent,
) -> dict[str, bool]:
    """Server-to-client event: Analyses generation error."""
    return {"success": True}
