"""Internal handler for test error events.

Handles: test_error_event — re-emits as test_error.
"""

from typing import Any

from app.main import get_internal_sio
from app.v5.socket.internal.test.types import TestErrorData

internal_sio = get_internal_sio()


@internal_sio.on("test_error_event")  # type: ignore
async def handle_test_error(data: dict[str, Any]) -> None:
    """Handle test error events."""
    invocation_id = data.get("invocation_id") or data.get("chat_id")
    message = data.get("error_message") or data.get("message", "Test error")
    sid = data.get("sid")
    invocation_id_str = str(invocation_id) if invocation_id else None
    rooms = (
        [sid, f"test_{invocation_id_str}"]
        if sid and invocation_id_str
        else ([sid] if sid else [])
    )

    await internal_sio.emit(
        "test_error",
        TestErrorData(
            sid=sid,
            rooms=rooms,
            invocation_id=invocation_id_str,
            run_id=str(data.get("run_id")) if data.get("run_id") else None,
            message=message,
            error_type=data.get("error_type"),
        ).model_dump(mode="json"),
    )
