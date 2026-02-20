"""Logins entry start handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.entries.logins.types import LoginsGenerationEvent
from app.socket.v4.entries.utils import resolve_entry_type

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_start(data: dict[str, Any]) -> None:
    """Logins generation started - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    event = LoginsGenerationEvent(
        artifact_type=data.get("artifact_type", ""),
        group_id=data.get("group_id", ""),
        run_id=data.get("run_id"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
    )

    await sio.emit(
        "logins_generation_started",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_start")  # type: ignore
async def logins_call_start_listener(data: dict[str, Any]) -> None:
    """Listen for tool_call_start events targeting logins."""
    if data.get("event_type") != "tool_call_start":
        return
    if resolve_entry_type(data) != "logins":
        return
    await handle_start(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/logins_generation_started")
async def logins_generation_started_api(
    request: LoginsGenerationEvent,
) -> dict[str, bool]:
    """Server-to-client event: Logins generation started."""
    return {"success": True}
