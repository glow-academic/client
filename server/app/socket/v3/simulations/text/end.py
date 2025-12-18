"""Handler for simulation_text_end WebSocket event."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import sio
from app.utils.activity.websocket_logger import log_websocket_activity
from app.utils.logging.db_logger import get_logger
from app.utils.websocket.remove_active_connection import remove_active_connection

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class ChatStoppedPayload(BaseModel):
    """Response indicating chat session stopped successfully."""

    chat_id: str
    chat_type: str


class SimulationTextEndErrorPayload(BaseModel):
    """Response indicating an error occurred while ending simulation chat session."""

    success: bool
    message: str


# Pydantic model for client-to-server event
class SimulationTextEndPayload(BaseModel):
    """Request to end a simulation chat session."""

    chat_id: str
    chat_type: str = "assistant"


# Emit helper functions
async def simulation_text_ended(payload: ChatStoppedPayload, room: str) -> None:
    await sio.emit("simulations_text_ended", payload.model_dump(), room=room)


async def simulation_text_end_error(
    payload: SimulationTextEndErrorPayload, room: str
) -> None:
    await sio.emit("simulations_text_end_error", payload.model_dump(), room=room)


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
        # Log activity
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.text.ended",
                template="{{ actor.name }} ended simulation chat",
                context={"chat_id": str(chat_id), "chat_type": chat_type},
                endpoint="/socket/v3/simulations/text/end",
                error=False,
            )
        except Exception as log_error:
            logger.warning(f"Error logging simulation end activity: {log_error}")


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
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.text.ended",
                template="{{ actor.name }} failed to end simulation chat (invalid payload)",
                context={"error": str(e)},
                endpoint="/socket/v3/simulations/text/end",
                error=True,
            )
        except Exception as log_error:
            logger.warning(f"Error logging simulation end validation error activity: {log_error}")


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/end", response_model=dict[str, bool])
async def simulation_text_end_api(request: SimulationTextEndPayload) -> dict[str, bool]:
    """Client-to-server event: End a simulation chat session."""
    return {"success": True}


@server_router.post("/ended", response_model=dict[str, bool])
async def simulation_text_ended_api(request: ChatStoppedPayload) -> dict[str, bool]:
    """Server-to-client event: Simulation chat session ended successfully."""
    return {"success": True}


@server_router.post("/end_error", response_model=dict[str, bool])
async def simulation_text_end_error_api(
    request: SimulationTextEndErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while ending simulation chat session."""
    return {"success": True}
