"""Server handler: test_stopped."""

from typing import Any

from app.globals import get_internal_sio, sio
from app.v5.api.socket.client.types import TestStoppedEvent

internal_sio = get_internal_sio()


@internal_sio.on("test_stopped")  # type: ignore
async def test_stopped_server_handler(data: dict[str, Any]) -> None:
    """Emit test_stopped to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = TestStoppedEvent(
        invocation_id=data.get("invocation_id", ""),
        success=data.get("success", True),
        message=data.get("message"),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit("test_stopped", event.model_dump(mode="json"), room=room)
