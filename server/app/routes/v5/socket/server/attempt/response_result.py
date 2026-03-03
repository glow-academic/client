"""Server handler: attempt_response_result."""

from typing import Any

from app.globals import get_internal_sio, sio
from app.routes.v5.socket.client.types import AttemptResponseResultEvent

internal_sio = get_internal_sio()


@internal_sio.on("attempt_response_result")  # type: ignore
async def attempt_response_result_server_handler(data: dict[str, Any]) -> None:
    """Emit attempt_response_result to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = AttemptResponseResultEvent(
        success=data.get("success", False),
        message=data.get("message"),
        is_correct=data.get("is_correct"),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit(
            "attempt_response_result", event.model_dump(mode="json"), room=room
        )
