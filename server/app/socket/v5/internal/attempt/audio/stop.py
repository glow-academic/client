"""Internal handler: generate_audio_session_complete — canonical audio session teardown.

Cleans up the audio session, emits attempt_audio_ended to notify client,
and logs activity. All paths that stop an audio session (client stop,
rate limit exceeded, etc.) emit generate_audio_session_complete to reach this handler.
"""

from typing import Any

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.audio_lifecycle import cleanup_audio_session
from app.infra.v4.websocket.session_store import get_session_by_group_id
from app.main import get_internal_sio
from app.socket.v5.internal.attempt.types import AttemptAudioEndedData

internal_sio = get_internal_sio()


@internal_sio.on("generate_audio_session_complete")  # type: ignore
async def handle_audio_session_complete(data: dict[str, Any]) -> None:
    """Clean up audio session and emit attempt_audio_ended."""
    sid = data.get("sid")
    group_id = data.get("group_id")
    if not sid:
        return

    # Clean up session (stop adapter + remove from store)
    session = get_session_by_group_id(group_id) if group_id else None
    chat_id = session.chat_id if session else (group_id or "")
    if session:
        await cleanup_audio_session(session)

    await internal_sio.emit(
        "attempt_audio_ended",
        AttemptAudioEndedData(
            sid=sid,
            chat_id=chat_id,
            success=True,
            message="Voice session stopped",
        ).model_dump(mode="json"),
    )

    # Log activity
    try:
        await log_websocket_activity(
            sid=sid,
            event_key="attempt.audio.stopped",
            template="{{ actor.name }} stopped voice session",
            context={"chat_id": chat_id, "group_id": group_id},
            endpoint="/socket/v5/attempt/audio_stop",
            error=False,
        )
    except Exception:
        pass
