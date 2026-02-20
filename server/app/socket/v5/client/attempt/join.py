"""Attempt join handler.

Handles: attempt_join — join a chat room for real-time updates.
"""

from typing import Any

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import sio
from app.socket.v5.client.types import AttemptJoinedEvent, AttemptJoinPayload
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


@sio.event  # type: ignore
async def attempt_join(sid: str, data: dict[str, Any]) -> None:
    """Join a chat room. Emits attempt_joined on success."""
    try:
        payload = AttemptJoinPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await sio.emit(
                "attempt_error",
                {
                    "chat_id": str(payload.chat_id),
                    "type": "join",
                    "message": "Profile not found. Please reconnect.",
                },
                room=sid,
            )
            return

        chat_id = str(payload.chat_id)
        room_name = f"attempt_{chat_id}"
        await sio.enter_room(sid, room_name)

        await sio.emit(
            "attempt_joined",
            AttemptJoinedEvent(chat_id=chat_id, success=True).model_dump(mode="json"),
            room=sid,
        )

    except Exception as e:
        logger.exception(f"Error in attempt_join: {e}")
        chat_id = data.get("chat_id", "")
        await sio.emit(
            "attempt_error",
            {
                "chat_id": str(chat_id) if chat_id else None,
                "type": "join",
                "message": f"Failed to join room: {e}",
            },
            room=sid,
        )
