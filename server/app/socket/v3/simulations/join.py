"""Handler for simulation_join WebSocket event."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import sio
from app.infra.activity.websocket_logger import log_websocket_activity
from utils.logging.db_logger import get_logger
from app.infra.websocket.set_active_connection import set_active_connection

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events (imported by server/join.py)
class SimulationJoinedPayload(BaseModel):
    """Response indicating successfully joined simulation chat room."""

    chat_id: str
    chat_type: str


class SimulationJoinErrorPayload(BaseModel):
    """Response indicating an error occurred while joining simulation chat room."""

    success: bool
    message: str


# Pydantic model for client-to-server event
class SimulationJoinPayload(BaseModel):
    """Request to join a simulation chat room for real-time updates."""

    chat_id: str
    chat_type: str = "assistant"


# Emit helper functions (imported by server/join.py)
async def simulation_joined(payload: SimulationJoinedPayload, room: str) -> None:
    await sio.emit("simulations_joined", payload.model_dump(), room=room)


async def simulation_join_error(payload: SimulationJoinErrorPayload, room: str) -> None:
    await sio.emit("simulations_join_error", payload.model_dump(), room=room)


async def _simulation_join_impl(sid: str, data: SimulationJoinPayload) -> None:
    """Join a specific chat room for real-time updates"""
    chat_id = data.chat_id
    chat_type = data.chat_type

    if chat_id:
        room_name = f"{chat_type}_{chat_id}"
        await sio.enter_room(sid, room_name)
        await set_active_connection(chat_id, sid)
        logger.info(
            f"Client {sid} joined {chat_type} chat {chat_id} (room: {room_name})"
        )
        await simulation_joined(
            SimulationJoinedPayload(chat_id=chat_id, chat_type=chat_type), room=sid
        )
        # Log activity
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.joined",
                template="{{ actor.name }} joined simulation chat",
                context={"chat_id": chat_id, "chat_type": chat_type},
                endpoint="/socket/v3/simulations/join",
                error=False,
            )
        except Exception as log_error:
            logger.warning(f"Error logging simulation join activity: {log_error}")


@sio.event  # type: ignore
async def simulation_join(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = SimulationJoinPayload(**data)
        await _simulation_join_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in simulation_join for {sid}: {e}")
        await simulation_join_error(
            SimulationJoinErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.joined",
                template="{{ actor.name }} failed to join simulation chat (invalid payload)",
                context={"error": str(e)},
                endpoint="/socket/v3/simulations/join",
                error=True,
            )
        except Exception as log_error:
            logger.warning(
                f"Error logging simulation join validation error activity: {log_error}"
            )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/join", response_model=dict[str, bool])
async def simulation_join_api(request: SimulationJoinPayload) -> dict[str, bool]:
    """Client-to-server event: Join a simulation chat room for real-time updates."""
    return {"success": True}


@server_router.post("/joined", response_model=dict[str, bool])
async def simulation_joined_api(request: SimulationJoinedPayload) -> dict[str, bool]:
    """Server-to-client event: Successfully joined simulation chat room."""
    return {"success": True}


@server_router.post("/join_error", response_model=dict[str, bool])
async def simulation_join_error_api(
    request: SimulationJoinErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while joining simulation chat room."""
    return {"success": True}
