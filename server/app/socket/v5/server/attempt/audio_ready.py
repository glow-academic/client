"""Server handler: attempt_audio_ready."""

from typing import Any

from app.main import get_internal_sio, sio
from app.socket.v5.client.types import AttemptAudioReadyEvent

internal_sio = get_internal_sio()


@internal_sio.on("attempt_audio_ready")  # type: ignore
async def attempt_audio_ready_server_handler(data: dict[str, Any]) -> None:
    """Emit attempt_audio_ready to client rooms."""
    sid = data.get("sid", "")
    if not sid:
        return
    event = AttemptAudioReadyEvent(
        chat_id=data.get("chat_id", ""),
        success=data.get("success", True),
        message=data.get("message"),
    )
    for room in data.get("rooms") or [sid]:
        await sio.emit("attempt_audio_ready", event.model_dump(mode="json"), room=room)
