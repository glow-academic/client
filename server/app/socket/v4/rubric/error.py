"""Rubric error handler - listens to internal error events and emits to clients."""

from typing import Any

from app.main import get_internal_sio, sio
from fastapi import APIRouter

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("rubric_error")  # type: ignore
async def handle_rubric_error(data: dict[str, Any]) -> None:
    """Handle rubric_error internal event - emit to client."""
    sid = data.get("sid", "")
    if not sid:
        return  # No socket ID, can't emit to client

    # Emit unified error event to client
    await sio.emit(
        "artifact_generation_error",
        {
            "resource_type": "rubric",
            "resource_id": data.get("resource_id"),
            "group_id": data.get("group_id"),
            "success": False,
            "message": data.get("message", "An error occurred during rubric generation"),
            "trace_id": data.get("trace_id"),
        },
        room=sid,
    )

