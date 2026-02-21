"""Server handler for test progress updates.

Listens to internal `test_progress` and emits to client:
- type=run_start    -> test_run_start
- type=run_delta    -> test_run_delta
- type=run_complete -> test_run_complete
- type=progress     -> test_progress_update
"""

from typing import Any

from app.main import get_internal_sio, sio
from app.socket.v5.client.types import (
    TestProgressEvent,
    TestRunCompleteEvent,
    TestRunDeltaEvent,
    TestRunStartEvent,
)

internal_sio = get_internal_sio()


@internal_sio.on("test_progress")  # type: ignore
async def test_progress_server_handler(data: dict[str, Any]) -> None:
    """Route progress-related test_progress events to clients."""
    event_type = data.get("type")
    if event_type not in ("run_start", "run_delta", "run_complete", "progress"):
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

    if event_type == "run_start":
        event = TestRunStartEvent(
            invocation_id=invocation_id,
            run_id=data.get("run_id", ""),
            original_run_resource_id=data.get("original_run_resource_id"),
            current_run=data.get("current_run", 1),
            total_runs=data.get("total_runs", 1),
            created_at=data.get("created_at", ""),
        )
        for room in all_rooms:
            await sio.emit("test_run_start", event.model_dump(mode="json"), room=room)

    elif event_type == "run_delta":
        delta_event = TestRunDeltaEvent(
            invocation_id=invocation_id,
            run_id=data.get("run_id", ""),
            content=data.get("content", ""),
        )
        for room in all_rooms:
            await sio.emit(
                "test_run_delta", delta_event.model_dump(mode="json"), room=room
            )

    elif event_type == "run_complete":
        complete_event = TestRunCompleteEvent(
            invocation_id=invocation_id,
            run_id=data.get("run_id", ""),
            original_run_resource_id=data.get("original_run_resource_id"),
            tool_calls=data.get("tool_calls"),
            current_run=data.get("current_run", 1),
            total_runs=data.get("total_runs", 1),
            remaining_runs=data.get("remaining_runs", 0),
        )
        for room in all_rooms:
            await sio.emit(
                "test_run_complete",
                complete_event.model_dump(mode="json"),
                room=room,
            )

    elif event_type == "progress":
        progress_event = TestProgressEvent(
            invocation_id=invocation_id,
            type=data.get("progress_type", "progress"),
            run_id=data.get("run_id"),
            current_run=data.get("current_run"),
            total_runs=data.get("total_runs"),
            message=data.get("message"),
        )
        for room in all_rooms:
            await sio.emit(
                "test_progress_update",
                progress_event.model_dump(mode="json"),
                room=room,
            )
