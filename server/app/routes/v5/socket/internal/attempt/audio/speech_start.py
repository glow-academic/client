"""Internal handler: generate_audio_user_speech_start → attempt_user_received_start.

VAD detected user speaking — emit received_start so the shared internal
handler creates the message shell.
"""

from typing import Any

from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.session_store import get_session_by_group_id
from app.infra.globals import get_internal_sio
from app.routes.v5.socket.internal.attempt.types import AttemptUserReceivedStartData

internal_sio = get_internal_sio()


@internal_sio.on("generate_audio_user_speech_start")  # type: ignore
async def handle_user_speech_start(data: dict[str, Any]) -> None:
    """Translate generate_audio_user_speech_start → attempt_user_received_start."""
    group_id = data.get("group_id")
    if not group_id:
        return
    session = get_session_by_group_id(group_id)
    if not session:
        return
    item_id = data.get("item_id")
    if not item_id:
        return

    profile_id_str = await find_profile_by_socket(session.sid)

    await internal_sio.emit(
        "attempt_user_received_start",
        AttemptUserReceivedStartData(
            sid=session.sid,
            chat_id=session.chat_id,
            run_id=session.run_id,
            profile_id=profile_id_str or "",
            item_id=item_id,
        ).model_dump(mode="json"),
    )
