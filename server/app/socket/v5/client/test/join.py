"""Test join handler.

Handles: test_join — join a test room for real-time updates.
"""

from typing import Any

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import sio
from app.socket.v5.client.types import TestErrorEvent, TestJoinedEvent, TestJoinPayload
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


@sio.event  # type: ignore
async def test_join(sid: str, data: dict[str, Any]) -> None:
    """Join a test room. Emits test_joined on success."""
    try:
        payload = TestJoinPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await sio.emit(
                "test_error",
                TestErrorEvent(
                    invocation_id=str(payload.invocation_id),
                    message="Profile not found. Please reconnect.",
                    error_type="join",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        invocation_id_str = str(payload.invocation_id)
        room_name = f"test_{invocation_id_str}"
        await sio.enter_room(sid, room_name)

        await sio.emit(
            "test_joined",
            TestJoinedEvent(invocation_id=invocation_id_str, success=True).model_dump(
                mode="json"
            ),
            room=sid,
        )

    except Exception as e:
        logger.exception(f"Error in test_join: {e}")
        invocation_id = data.get("invocation_id", "")
        await sio.emit(
            "test_error",
            TestErrorEvent(
                invocation_id=str(invocation_id) if invocation_id else None,
                message=f"Failed to join room: {e}",
                error_type="join",
            ).model_dump(mode="json"),
            room=sid,
        )
