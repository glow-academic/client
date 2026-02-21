"""Client-facing attempt_audio_stop handler.

Stops the audio session, cleans it up, and emits generate_audio_complete
to the internal layer for domain translation.
"""

from typing import Any

from app.infra.v4.websocket.audio_lifecycle import cleanup_audio_session
from app.infra.v4.websocket.session_store import get_session_by_sid
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()


@sio.event  # type: ignore
async def attempt_audio_stop(sid: str, data: dict[str, Any]) -> None:
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
