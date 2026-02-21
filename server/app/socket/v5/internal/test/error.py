"""Internal handler for test error events.

Handles: test_error_event — re-emits as test_progress(type=error).
"""

from typing import Any

from app.main import get_internal_sio

internal_sio = get_internal_sio()


@internal_sio.on("test_error_event")  # type: ignore
async def handle_test_error(data: dict[str, Any]) -> None:
    """Handle test error events."""
    invocation_id = data.get("invocation_id") or data.get("chat_id")
    message = data.get("error_message") or data.get("message", "Test error")

    await internal_sio.emit(
        "test_progress",
        {
            "type": "error",
            "sid": data.get("sid"),
            "invocation_id": str(invocation_id) if invocation_id else None,
            "run_id": str(data.get("run_id")) if data.get("run_id") else None,
            "message": message,
            "error_type": data.get("error_type"),
        },
    )
