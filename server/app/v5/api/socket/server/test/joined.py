"""Server handler: test_joined."""

from typing import Any

from app.globals import get_internal_sio, sio
from app.v5.api.socket.client.types import TestJoinedEvent

internal_sio = get_internal_sio()


@internal_sio.on("test_joined")  # type: ignore
async def test_joined_server_handler(data: dict[str, Any]) -> None:
    """Emit test_joined to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = TestJoinedEvent(
        invocation_id=data.get("invocation_id", ""),
        success=data.get("success", True),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit("test_joined", event.model_dump(mode="json"), room=room)
