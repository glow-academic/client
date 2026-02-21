"""Internal handler: generate_audio_complete → attempt_progress(type=audio_ended).

Resolves chat_id from session and signals the client that the voice session has ended.
"""

from typing import Any

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.session_store import get_session_by_group_id
from app.main import get_internal_sio

internal_sio = get_internal_sio()


@internal_sio.on("generate_audio_complete")  # type: ignore
async def handle_audio_complete(data: dict[str, Any]) -> None:
    """Translate generate_audio_complete → attempt_progress(type=audio_ended)."""
    sid = data.get("sid")
    group_id = data.get("group_id")
    if not sid:
        return
    session = get_session_by_group_id(group_id) if group_id else None
    chat_id = session.chat_id if session else (group_id or "")
    await internal_sio.emit(
        "attempt_progress",
        {
            "type": "audio_ended",
            "sid": sid,
            "chat_id": chat_id,
            "success": True,
            "message": "Voice session stopped",
        },
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
