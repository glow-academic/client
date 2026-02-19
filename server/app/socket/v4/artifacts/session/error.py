"""Session error handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_error")  # type: ignore
async def handle_session_error(data: dict[str, Any]) -> None:
    """Forward session generation errors to clients."""
    if data.get("artifact_type") != "session":
        return

    sid = data.get("sid")
    if not sid:
        return

    error_message = data.get("error_message") or data.get(
        "message", "An error occurred during session generation"
    )

    await sio.emit(
        "session_generation_error",
        {
            "artifact_type": "session",
            "resource_type": data.get("resource_type"),
            "resource_types": data.get("resource_types"),
            "resource_id": data.get("resource_id"),
            "group_id": data.get("group_id"),
            "success": False,
            "message": error_message,
            "trace_id": data.get("trace_id"),
        },
        room=sid,
    )


@server_router.post("/session_generation_error")
async def session_generation_error_api(
    request: dict[str, Any],
) -> dict[str, bool]:
    """Server-to-client event: session generation error."""
    _ = request
    return {"ok": True}
