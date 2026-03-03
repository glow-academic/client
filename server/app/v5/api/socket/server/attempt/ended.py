"""Server handler: attempt_ended."""

from typing import Any

from app.globals import get_internal_sio, sio
from app.v5.api.socket.client.types import AttemptEndedEvent

internal_sio = get_internal_sio()


@internal_sio.on("attempt_ended")  # type: ignore
async def attempt_ended_server_handler(data: dict[str, Any]) -> None:
    """Emit attempt_ended to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = AttemptEndedEvent(
        attempt_id=data.get("attempt_id", ""),
        success=data.get("success", False),
        all_scenarios_complete=data.get("all_scenarios_complete", False),
        message=data.get("message"),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit("attempt_ended", event.model_dump(mode="json"), room=room)
