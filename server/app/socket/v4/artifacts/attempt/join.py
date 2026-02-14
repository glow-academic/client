"""Attempt join handler.

Handles WebSocket event:
- attempt_join: Join a chat room for real-time updates
"""

from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import sio
from app.socket.v4.artifacts.attempt.types import (
    AttemptJoinedEvent,
    AttemptJoinPayload,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


@sio.event  # type: ignore
async def attempt_join(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_join event - join a chat room.

    Emits attempt_joined on success.
    """
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

        # Join the room
        await sio.enter_room(sid, room_name)

        # Emit success event
        event = AttemptJoinedEvent(
            chat_id=chat_id,
            success=True,
        )

        await sio.emit(
            "attempt_joined",
            event.model_dump(mode="json"),
            room=sid,
        )

        logger.info(f"Client {sid} joined room {room_name}")

    except Exception as e:
        logger.exception(f"Error in attempt_join: {str(e)}")
        chat_id = data.get("chat_id", "")
        await sio.emit(
            "attempt_error",
            {
                "chat_id": str(chat_id) if chat_id else None,
                "type": "join",
                "message": f"Failed to join room: {str(e)}",
            },
            room=sid,
        )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/attempt/join", response_model=dict[str, bool])
async def attempt_join_api(request: AttemptJoinPayload) -> dict[str, bool]:
    """Client-to-server event: Join a chat room for real-time updates."""
    return {"success": True}


@server_router.post("/attempt/joined", response_model=dict[str, bool])
async def attempt_joined_api(request: AttemptJoinedEvent) -> dict[str, bool]:
    """Server-to-client event: Successfully joined a chat room."""
    return {"success": True}
