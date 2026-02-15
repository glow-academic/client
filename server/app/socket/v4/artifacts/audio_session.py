"""Generic audio session handlers (frame, mute, stop).

Any domain can start an audio session via generate_artifact(modality="audio"),
and the client interacts via these generic events.
"""

import asyncio
import time
from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.audio_lifecycle import cleanup_audio_session
from app.infra.v4.websocket.session_store import get_session_by_sid
from app.main import get_internal_sio, sio
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)
internal_sio = get_internal_sio()
client_router = APIRouter()
server_router = APIRouter()


@sio.event  # type: ignore
async def audio_frame(sid: str, data: dict[str, Any]) -> None:
    """Push audio frame into session inbound queue."""
    session = get_session_by_sid(sid)
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


@sio.event  # type: ignore
async def audio_mute(sid: str, data: dict[str, Any]) -> None:
    """Push mute control message into session inbound queue."""
    session = get_session_by_sid(sid)
    if not session:
        return
    await session.inbound_queue.put(
        {"type": "mic.set_muted", "muted": data.get("muted", False)}
    )


@sio.event  # type: ignore
async def audio_stop(sid: str, data: dict[str, Any]) -> None:
    """Stop audio session and clean up."""
    session = get_session_by_sid(sid)
    if not session:
        return
    group_id = session.group_id
    await cleanup_audio_session(session)
    await internal_sio.emit(
        "generate_audio_complete",
        {
            "group_id": group_id,
            "sid": sid,
        },
    )
