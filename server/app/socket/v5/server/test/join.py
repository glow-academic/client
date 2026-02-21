"""Server handler for test room events.

Listens to internal `test_progress` and emits to client:
- type=joined -> test_joined
- type=error  -> test_error
"""

from typing import Any

from app.main import get_internal_sio, sio
from app.socket.v5.client.types import TestErrorEvent, TestJoinedEvent

internal_sio = get_internal_sio()


@internal_sio.on("test_progress")  # type: ignore
async def test_progress_server_handler(data: dict[str, Any]) -> None:
    """Route test_progress events to clients."""
    event_type = data.get("type")
    if event_type not in ("joined", "error"):
        return

    sid = data.get("sid", "")
    if not sid:
        return

    rooms = data.get("rooms") or [sid]

    if event_type == "joined":
        event = TestJoinedEvent(
            invocation_id=data.get("invocation_id", ""),
            success=data.get("success", True),
        )
        for room in rooms:
            await sio.emit("test_joined", event.model_dump(mode="json"), room=room)

    elif event_type == "error":
        event = TestErrorEvent(
            invocation_id=data.get("invocation_id"),
            run_id=data.get("run_id"),
            message=data.get("message", "Unknown error"),
            error_type=data.get("error_type"),
        )
        for room in rooms:
            await sio.emit("test_error", event.model_dump(mode="json"), room=room)
