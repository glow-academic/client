"""Client-facing attempt_audio_mute handler.

Pushes mute control messages into the session's inbound queue.
"""

from typing import Any

from app.infra.v4.websocket.session_store import get_session_by_sid
from app.main import sio


@sio.event  # type: ignore
async def attempt_audio_mute(sid: str, data: dict[str, Any]) -> None:
    """Push mute control message into session inbound queue."""
    session = get_session_by_sid(sid)
    if not session:
        return
    await session.inbound_queue.put(
        {"type": "mic.set_muted", "muted": data.get("muted", False)}
    )
