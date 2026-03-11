"""Attempt response handler (placeholder) — thin wrapper."""

from typing import Any

from app.infra.globals import get_internal_sio, sio
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket
from app.routes.v5.socket.client.types import AttemptResponsePayload
from app.routes.v5.socket.internal.attempt.types import (
    AttemptErrorData,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@sio.event  # type: ignore
async def attempt_response_submit(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_response_submit event — submit a video question response."""
    try:
        payload = AttemptResponsePayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="quiz",
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
                    error_type="quiz",
                    message="Session not found. Please reconnect.",
                ).model_dump(mode="json"),
            )
            return

        await internal_sio.emit(
            "attempt_response_submit",
            {
                "sid": sid,
                "profile_id": profile_id_str,
                "session_id": session_id_str,
                **payload.model_dump(mode="json"),
            },
        )

    except Exception as e:
        logger.exception(f"Invalid request in attempt_response_submit: {e}")
        chat_id = data.get("chat_id", "")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="quiz",
                message=f"Invalid request: {e}",
                chat_id=str(chat_id) if chat_id else None,
            ).model_dump(mode="json"),
        )
