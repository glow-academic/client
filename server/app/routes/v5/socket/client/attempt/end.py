"""Attempt end handler — thin wrapper."""

from typing import Any

from app.infra.globals import get_internal_sio, sio
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket
from app.routes.v5.socket.client.types import AttemptEndPayload
from app.routes.v5.socket.internal.attempt.types import AttemptErrorData
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

@sio.event  # type: ignore
async def attempt_end(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_end event — validate transport data and dispatch internal."""
    try:
        payload = AttemptEndPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="end",
                    message="Profile not found. Please reconnect.",
                ).model_dump(mode="json"),
            )
            return

        session_id_str = await find_session_by_socket(sid)
        if not session_id_str:
            raise ValueError("Session not found for socket")

        await internal_sio.emit(
            "attempt_end",
            {
                "sid": sid,
                "profile_id": profile_id_str,
                "session_id": session_id_str,
                **payload.model_dump(mode="json"),
            },
        )

    except Exception as e:
        logger.exception(f"Error in attempt_end: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="end",
                message=f"Failed to end chat: {e}",
                chat_id=str(data.get("chat_id", "")) if data.get("chat_id") else None,
            ).model_dump(mode="json"),
        )
