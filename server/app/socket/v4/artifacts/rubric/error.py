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

    error_message = data.get("message", "An error occurred during rubric generation")
    error_payload = {
        "resource_type": "rubric",
        "resource_id": data.get("resource_id"),
        "group_id": data.get("group_id"),
        "success": False,
        "message": error_message,
        "trace_id": data.get("trace_id"),
    }

    # Emit unified error event to client (new architecture)
    await sio.emit(
        "artifact_generation_error",
        error_payload,
        room=sid,
    )

    # Also emit legacy event name for backward compatibility with frontend
    await sio.emit(
        "rubrics_generation_error",
        {
            "success": False,
            "message": error_message,
            "trace_id": data.get("trace_id"),
        },
        room=sid,
    )
