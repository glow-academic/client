"""Server handler: attempt_assistant_hints."""

from typing import Any

from app.infra.globals import get_internal_sio, sio
from app.routes.v5.socket.client.types import AttemptAssistantHintsEvent

internal_sio = get_internal_sio()


@internal_sio.on("attempt_assistant_hints")  # type: ignore
async def attempt_assistant_hints_server_handler(data: dict[str, Any]) -> None:
    """Emit attempt_assistant_hints to client rooms."""
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    if not rooms:
        return
    event = AttemptAssistantHintsEvent(
        chat_id=data.get("chat_id", ""),
        hints=data.get("hints", []),
    )
    for room in rooms:
        await sio.emit(
            "attempt_assistant_hints", event.model_dump(mode="json"), room=room
        )
