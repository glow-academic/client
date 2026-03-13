"""Client-facing attempt_audio_frame handler.

Thin wrapper — delegates to attempt_audio_frame_internal_impl.
"""

from typing import Any

from app.infra.globals import sio
from app.socket.v5.client.attempt.audio.frame_impl import (
    attempt_audio_frame_internal_impl,
)


@sio.event  # type: ignore
async def attempt_audio_frame(sid: str, data: dict[str, Any]) -> None:
    """Push audio frame into session inbound queue."""
    chat_id = data.get("chat_id")
    if not chat_id:
        return
    audio_data = data.get("audio")
    if not audio_data:
        return
    attempt_audio_frame_internal_impl(chat_id=chat_id, audio=audio_data)
