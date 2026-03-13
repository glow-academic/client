"""Attempt grade handler — thin wrapper."""

from __future__ import annotations

from typing import Any

from app.infra.globals import get_internal_sio, sio
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket
from app.socket.v5.client.types import AttemptGradePayload
from app.socket.v5.internal.attempt.types import AttemptErrorData
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@sio.event  # type: ignore
async def attempt_grade(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_grade event — validate transport data and dispatch internal."""
    try:
        payload = AttemptGradePayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="grade",
                    message="Profile not found. Please reconnect.",
                    chat_id=str(payload.chat_id) if payload.chat_id else None,
                ).model_dump(mode="json"),
            )
            return

        session_id_str = await find_session_by_socket(sid)
        if not session_id_str:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="grade",
                    message="Session not found. Please reconnect.",
                    chat_id=str(payload.chat_id) if payload.chat_id else None,
                ).model_dump(mode="json"),
            )
            return

        await internal_sio.emit(
            "attempt_grade",
            {
                "sid": sid,
                "profile_id": profile_id_str,
                "session_id": session_id_str,
                **payload.model_dump(mode="json"),
            },
        )
    except Exception as e:
        logger.exception(f"Error in attempt_grade: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="grade",
                message=f"Failed to trigger grading: {e}",
                chat_id=str(data.get("chat_id", "")) if data.get("chat_id") else None,
            ).model_dump(mode="json"),
        )
