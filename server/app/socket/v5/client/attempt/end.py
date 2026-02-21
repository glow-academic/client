"""Attempt end handler.

Handles: attempt_end — end a single chat within an attempt.

Delegates to the internal attempt_chat handler to mark the chat as completed.
"""

from typing import Any

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import get_internal_sio, sio
from app.socket.v5.client.types import AttemptEndPayload
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


async def _attempt_end_impl(sid: str, data: AttemptEndPayload) -> None:
    """Handle attempt_end — end a single chat by delegating to attempt_chat."""
    try:
        attempt_id = str(data.attempt_id)
        chat_id = str(data.chat_id)

        # Delegate to internal attempt_chat handler
        await internal_sio.emit(
            "attempt_chat",
            {
                "sid": sid,
                "attempt_id": attempt_id,
                "completed_chat_ids": [chat_id],
            },
        )

        # Trigger grading via internal bus
        await internal_sio.emit(
            "attempt_grade",
            {
                "sid": sid,
                "attempt_id": attempt_id,
                "chat_id": chat_id,
            },
        )

        # Log activity
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="attempt.end.ended",
                template="{{ actor.name }} ended chat",
                context={"attempt_id": attempt_id},
                endpoint="/socket/v5/attempt/end",
                error=False,
            )
        except Exception:
            pass

    except Exception as e:
        logger.exception(f"Error in attempt_end: {e}")
        await internal_sio.emit(
            "attempt_progress",
            {
                "type": "error",
                "sid": sid,
                "error_type": "end",
                "message": f"Failed to end chat: {e}",
                "chat_id": str(data.chat_id) if data.chat_id else None,
            },
        )


@sio.event  # type: ignore
async def attempt_end(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_end event — end a single chat."""
    try:
        payload = AttemptEndPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await internal_sio.emit(
                "attempt_progress",
                {
                    "type": "error",
                    "sid": sid,
                    "error_type": "end",
                    "message": "Profile not found. Please reconnect.",
                },
            )
            return

        await _attempt_end_impl(sid, payload)

    except Exception as e:
        logger.exception(f"Invalid request in attempt_end: {e}")
        await internal_sio.emit(
            "attempt_progress",
            {
                "type": "error",
                "sid": sid,
                "error_type": "end",
                "message": f"Invalid request: {e}",
            },
        )
