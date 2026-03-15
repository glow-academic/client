"""Input: attempt.audio_frame"""

from typing import Any

from app.infra.globals import sio
from app.socket.v5.client.attempt.audio.frame_impl import (
    attempt_audio_frame_internal_impl,
)


@sio.on("attempt.audio_frame")  # type: ignore
async def attempt_audio_frame(sid: str, data: dict[str, Any]) -> None:
    chat_id = data.get("chat_id")
    if not chat_id:
        return
    audio = data.get("audio")
    if not audio:
        return
    attempt_audio_frame_internal_impl(chat_id=chat_id, audio=audio)
