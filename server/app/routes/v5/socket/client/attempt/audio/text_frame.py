"""Client-facing attempt_text_frame handler.

Pushes a text message into the session's inbound queue
for injection into a running voice session.
"""

from typing import Any

from app.infra.websocket.session_store import get_session_by_chat_id
from app.infra.globals import sio


@sio.event  # type: ignore
async def attempt_text_frame(sid: str, data: dict[str, Any]) -> None:
    """Push text message into session inbound queue."""
    chat_id = data.get("chat_id")
    if not chat_id:
        return
    session = get_session_by_chat_id(chat_id)
    if not session:
        return
    message = data.get("message")
    if not message:
        return
    await session.inbound_queue.put({"type": "text", "message": message})
