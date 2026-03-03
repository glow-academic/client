"""Client-facing attempt_audio_frame handler.

Pushes PCM16 audio frames into the session's inbound queue
with backpressure handling (drops frames if queue is full).
"""

import asyncio
import time
from typing import Any

from app.infra.websocket.session_store import get_session_by_chat_id
from app.globals import sio


@sio.event  # type: ignore
async def attempt_audio_frame(sid: str, data: dict[str, Any]) -> None:
    """Push audio frame into session inbound queue."""
    chat_id = data.get("chat_id")
    if not chat_id:
        return
    session = get_session_by_chat_id(chat_id)
    if not session:
        return
    audio_data = data.get("audio")
    if not audio_data:
        return
    session.last_activity = time.monotonic()
    try:
        session.inbound_queue.put_nowait({"type": "audio", "pcm16_bytes": audio_data})
    except asyncio.QueueFull:
        pass  # Backpressure: drop frame
