"""Client-facing attempt_audio_start handler.

Thin wrapper — delegates to attempt_audio_start_internal_impl.
"""

from typing import Any

from app.infra.globals import sio
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket
from app.socket.v5.client.attempt.audio.start_impl import (
    attempt_audio_start_internal_impl,
)
from app.socket.v5.internal.attempt.types import AttemptErrorData
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


@sio.event  # type: ignore
async def attempt_audio_start(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_audio_start — delegate to internal impl."""
    from app.infra.globals import get_internal_sio

    internal_sio = get_internal_sio()

    try:
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="audio",
                    message="Profile not found. Please reconnect.",
                ).model_dump(mode="json"),
            )
            return

        session_id_str = await find_session_by_socket(sid)
        if not session_id_str:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="audio",
                    message="Session not found. Please reconnect.",
                    chat_id=str(data.get("chat_id", "")),
                ).model_dump(mode="json"),
            )
            return

        await attempt_audio_start_internal_impl(
            {
                **data,
                "sid": sid,
                "profile_id": profile_id_str,
                "session_id": session_id_str,
            }
        )

    except Exception as e:
        logger.exception(f"Error in attempt_audio_start: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="audio",
                message=f"Failed to start voice session: {e}",
            ).model_dump(mode="json"),
        )
