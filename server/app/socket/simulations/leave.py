"""Handler for simulation_leave WebSocket event."""

from typing import Any

from pydantic import BaseModel, ValidationError

from app.main import sio
from app.utils.logging.db_logger import get_logger
from app.utils.websocket.remove_active_connection import remove_active_connection

logger = get_logger(__name__)


# Pydantic models for server-to-client events
class SimulationLeaveErrorPayload(BaseModel):
    success: bool
    message: str


# Pydantic model for client-to-server event
class SimulationLeavePayload(BaseModel):
    chat_id: str
    chat_type: str = "assistant"


# Emit helper functions
async def simulation_leave_error(payload: SimulationLeaveErrorPayload, room: str) -> None:
    await sio.emit("simulation_leave_error", payload.model_dump(), room=room)


async def _simulation_leave_impl(sid: str, data: SimulationLeavePayload) -> None:
    """Leave a specific chat room"""
    chat_id = data.chat_id
    chat_type = data.chat_type

    if chat_id:
        room_name = f"{chat_type}_{chat_id}"
        await sio.leave_room(sid, room_name)
        await remove_active_connection(chat_id)
        logger.info(f"Client {sid} left {chat_type} chat {chat_id}")


@sio.event  # type: ignore
async def simulation_leave(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = SimulationLeavePayload(**data)
        await _simulation_leave_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in simulation_leave for {sid}: {e}")
        await simulation_leave_error(
            SimulationLeaveErrorPayload(success=False, message=f"Invalid payload: {str(e)}"),
            room=sid,
        )

