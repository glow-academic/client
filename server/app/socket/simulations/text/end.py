"""Handler for simulation_text_end WebSocket event."""

from typing import Any

from pydantic import BaseModel, ValidationError

from app.main import sio
from app.utils.logging.db_logger import get_logger
from app.utils.websocket.remove_active_connection import remove_active_connection

logger = get_logger(__name__)


# Pydantic models for server-to-client events
class ChatStoppedPayload(BaseModel):
    chat_id: str
    chat_type: str


class SimulationTextEndErrorPayload(BaseModel):
    success: bool
    message: str


# Pydantic model for client-to-server event
class SimulationTextEndPayload(BaseModel):
    chat_id: str
    chat_type: str = "assistant"


# Emit helper functions
async def simulation_text_ended(payload: ChatStoppedPayload, room: str) -> None:
    await sio.emit("simulation_text_ended", payload.model_dump(), room=room)


async def simulation_text_end_error(
    payload: SimulationTextEndErrorPayload, room: str
) -> None:
    await sio.emit("simulation_text_end_error", payload.model_dump(), room=room)


async def _simulation_text_end_impl(sid: str, data: SimulationTextEndPayload) -> None:
    """Handle chat stop requests via WebSocket. TODO: Fix this to work and be generic."""
    chat_id = data.chat_id
    chat_type = data.chat_type

    if chat_id:
        await simulation_text_ended(
            ChatStoppedPayload(chat_id=str(chat_id), chat_type=chat_type), room=sid
        )
        await remove_active_connection(chat_id)
        logger.info(f"Client {sid} left {chat_type} chat {chat_id}")


@sio.event  # type: ignore
async def simulation_text_end(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = SimulationTextEndPayload(**data)
        await _simulation_text_end_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in simulation_text_end for {sid}: {e}")
        await simulation_text_end_error(
            SimulationTextEndErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )
