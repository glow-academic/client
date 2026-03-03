"""Attempt join handler.

Handles: attempt_join — join a chat room for real-time updates.
"""

from typing import Any

from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.globals import get_internal_sio, sio
from app.routes.v5.socket.client.types import AttemptJoinPayload
from app.routes.v5.socket.internal.attempt.types import AttemptErrorData, AttemptJoinedData
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@sio.event  # type: ignore
async def attempt_join(sid: str, data: dict[str, Any]) -> None:
    """Join a chat room. Emits attempt_joined on success."""
    try:
        payload = AttemptJoinPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="join",
                    message="Profile not found. Please reconnect.",
                    chat_id=str(payload.chat_id),
                ).model_dump(mode="json"),
            )
            return

        chat_id = str(payload.chat_id)
        room_name = f"attempt_{chat_id}"
        await sio.enter_room(sid, room_name)

        await internal_sio.emit(
            "attempt_joined",
            AttemptJoinedData(
                sid=sid,
                chat_id=chat_id,
                success=True,
            ).model_dump(mode="json"),
        )

    except Exception as e:
        logger.exception(f"Error in attempt_join: {e}")
        chat_id = data.get("chat_id", "")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="join",
                message=f"Failed to join room: {e}",
                chat_id=str(chat_id) if chat_id else None,
            ).model_dump(mode="json"),
        )
