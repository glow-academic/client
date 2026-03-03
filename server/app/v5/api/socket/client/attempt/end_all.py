"""Attempt end all handler.

Handles: attempt_end_all — end all remaining chats in an attempt.

Delegates to attempt_proceed(complete_all=True), which marks all remaining
chats as completed and emits attempt_ended.
"""

from typing import Any

from app.globals import get_internal_sio, sio
from app.v5.api.socket.client.types import AttemptEndAllPayload
from app.v5.api.socket.internal.attempt.types import AttemptErrorData, AttemptProceedData
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


async def _attempt_end_all_impl(sid: str, data: AttemptEndAllPayload) -> None:
    """Handle attempt_end_all — delegate to attempt_proceed with complete_all."""
    try:
        attempt_id = str(data.attempt_id)

        # Delegate to attempt_proceed with complete_all=True
        await internal_sio.emit(
            "attempt_proceed",
            AttemptProceedData(
                sid=sid,
                attempt_id=attempt_id,
                complete_all=True,
            ).model_dump(mode="json"),
        )

        # Log activity
        try:
            pass
        except Exception:
            pass

    except Exception as e:
        logger.exception(f"Error in attempt_end_all: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="end",
                message=f"Failed to end all chats: {e}",
            ).model_dump(mode="json"),
        )


@sio.event  # type: ignore
async def attempt_end_all(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_end_all event — end all chats in an attempt."""
    try:
        payload = AttemptEndAllPayload(**data)
        await _attempt_end_all_impl(sid, payload)

    except Exception as e:
        logger.exception(f"Invalid request in attempt_end_all: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="end",
                message=f"Invalid request: {e}",
            ).model_dump(mode="json"),
        )
