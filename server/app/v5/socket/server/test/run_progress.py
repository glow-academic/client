"""Server handler: test_run_delta."""

from typing import Any

from app.globals import get_internal_sio, sio
from app.v5.socket.client.types import TestRunDeltaEvent

internal_sio = get_internal_sio()


@internal_sio.on("test_run_delta")  # type: ignore
async def test_run_delta_server_handler(data: dict[str, Any]) -> None:
    """Emit test_run_delta to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = TestRunDeltaEvent(
        invocation_id=data.get("invocation_id", ""),
        run_id=data.get("run_id", ""),
        content=data.get("content", ""),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit("test_run_delta", event.model_dump(mode="json"), room=room)
