"""Server handler for connection lifecycle events.

Listens to internal `connection_progress` and emits to client:
- type=confirmed -> connection_confirmed
"""

from typing import Any

from app.globals import get_internal_sio, sio
from app.v5.api.socket.client.types import ConnectionConfirmedPayload

internal_sio = get_internal_sio()


@internal_sio.on("connection_progress")  # type: ignore
async def connection_progress_server_handler(data: dict[str, Any]) -> None:
    """Route connection_progress events to clients."""
    if data.get("type") != "confirmed":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    event = ConnectionConfirmedPayload(
        sid=data.get("payload_sid", sid),
        profile_id=data.get("profile_id"),
        guest_id=data.get("guest_id"),
        server_time=data.get("server_time", 0.0),
    )

    for room in data.get("rooms") or [sid]:
        await sio.emit("connection_confirmed", event.model_dump(mode="json"), room=room)
