"""Server handler: test_started."""

from typing import Any

from app.globals import get_internal_sio, sio
from app.routes.v5.socket.client.types import TestStartedEvent

internal_sio = get_internal_sio()


@internal_sio.on("test_started")  # type: ignore
async def test_started_server_handler(data: dict[str, Any]) -> None:
    """Emit test_started to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = TestStartedEvent(
        test_id=data.get("test_id", ""),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit("test_started", event.model_dump(mode="json"), room=room)
