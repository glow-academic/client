"""Server handler for test completion signals.

Listens to internal `test_progress` and emits to client:
- type=graded       -> test_graded
- type=all_complete -> test_all_complete
- type=stopped      -> test_stopped
"""

from typing import Any

from app.main import get_internal_sio, sio
from app.socket.v5.client.types import (
    TestAllCompleteEvent,
    TestGradedEvent,
    TestStoppedEvent,
)

internal_sio = get_internal_sio()


@internal_sio.on("test_progress")  # type: ignore
async def test_complete_server_handler(data: dict[str, Any]) -> None:
    """Route completion-related test_progress events to clients."""
    event_type = data.get("type")
    if event_type not in ("graded", "all_complete", "stopped"):
        return

    sid = data.get("sid", "")
    if not sid:
        return

    rooms = data.get("rooms") or [sid]
    invocation_id = data.get("invocation_id", "")

    # Also emit to the test room for multi-tab sync
    room_name = f"test_{invocation_id}" if invocation_id else None
    all_rooms = list(rooms)
    if room_name and room_name not in all_rooms:
        all_rooms.append(room_name)

    if event_type == "graded":
        event = TestGradedEvent(
            invocation_id=invocation_id,
            grade_id=data.get("grade_id"),
            score=data.get("score"),
            passed=data.get("passed"),
            feedback=data.get("feedback"),
        )
        for room in all_rooms:
            await sio.emit("test_graded", event.model_dump(mode="json"), room=room)

    elif event_type == "all_complete":
        all_complete_event = TestAllCompleteEvent(
            invocation_id=invocation_id,
            total_runs=data.get("total_runs", 0),
            success=data.get("success", True),
        )
        for room in all_rooms:
            await sio.emit(
                "test_all_complete",
                all_complete_event.model_dump(mode="json"),
                room=room,
            )

    elif event_type == "stopped":
        stopped_event = TestStoppedEvent(
            invocation_id=invocation_id,
            success=data.get("success", True),
            message=data.get("message"),
        )
        for room in all_rooms:
            await sio.emit(
                "test_stopped", stopped_event.model_dump(mode="json"), room=room
            )
