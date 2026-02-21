"""Server handler for test errors.

Listens to internal `test_progress` and emits to client:
- type=error -> test_error
"""

from typing import Any

from app.main import get_internal_sio, sio
from app.socket.v5.client.types import TestErrorEvent

internal_sio = get_internal_sio()


@internal_sio.on("test_progress")  # type: ignore
async def test_error_server_handler(data: dict[str, Any]) -> None:
    """Route error test_progress events to clients."""
    if data.get("type") != "error":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    invocation_id = data.get("invocation_id")

    event = TestErrorEvent(
        invocation_id=invocation_id,
        run_id=data.get("run_id"),
        message=data.get("message", "Unknown error"),
        error_type=data.get("error_type"),
    )

    rooms = data.get("rooms") or [sid]
    all_rooms = list(rooms)

    # Also emit to the test room
    if invocation_id:
        room_name = f"test_{invocation_id}"
        if room_name not in all_rooms:
            all_rooms.append(room_name)

    for room in all_rooms:
        await sio.emit("test_error", event.model_dump(mode="json"), room=room)
