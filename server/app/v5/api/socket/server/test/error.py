"""Server handler: test_error."""

from typing import Any

from app.globals import get_internal_sio, sio
from app.v5.api.socket.client.types import TestErrorEvent

internal_sio = get_internal_sio()


@internal_sio.on("test_error")  # type: ignore
async def test_error_server_handler(data: dict[str, Any]) -> None:
    """Emit test_error to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = TestErrorEvent(
        invocation_id=data.get("invocation_id"),
        run_id=data.get("run_id"),
        message=data.get("message", "Unknown error"),
        error_type=data.get("error_type"),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit("test_error", event.model_dump(mode="json"), room=room)
