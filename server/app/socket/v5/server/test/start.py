"""Server handler for test start signals.

Listens to internal `test_progress` and emits to client:
- type=started -> test_started
- type=joined  -> test_joined
"""

from typing import Any

from app.main import get_internal_sio, sio
from app.socket.v5.client.types import TestJoinedEvent, TestStartedEvent

internal_sio = get_internal_sio()


@internal_sio.on("test_progress")  # type: ignore
async def test_start_server_handler(data: dict[str, Any]) -> None:
    """Route start-related test_progress events to clients."""
    event_type = data.get("type")
    if event_type not in ("started", "joined"):
        return

    sid = data.get("sid", "")
    if not sid:
        return

    rooms = data.get("rooms") or [sid]

    if event_type == "started":
        event = TestStartedEvent(
            test_id=data.get("test_id", ""),
        )
        for room in rooms:
            await sio.emit("test_started", event.model_dump(mode="json"), room=room)

    elif event_type == "joined":
        joined_event = TestJoinedEvent(
            invocation_id=data.get("invocation_id", ""),
            success=data.get("success", True),
        )
        for room in rooms:
            await sio.emit(
                "test_joined", joined_event.model_dump(mode="json"), room=room
            )
