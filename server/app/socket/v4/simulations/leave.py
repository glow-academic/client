"""Handler for simulation_leave WebSocket event."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.remove_active_connection import remove_active_connection
from app.main import sio

client_router = APIRouter()
server_router = APIRouter()
_ALLOWED_CHAT_TYPES = {"assistant", "simulation"}
_CHAT_TYPE_ALIASES = {"any": "simulation"}


# Pydantic models for server-to-client events (imported by server/leave.py)
class SimulationLeaveErrorPayload(BaseModel):
    """Response indicating an error occurred while leaving simulation chat room."""

    success: bool
    message: str


# Pydantic model for client-to-server event
class SimulationLeavePayload(BaseModel):
    """Request to leave a simulation chat room."""

    chat_id: str
    chat_type: str = "assistant"


# Emit helper functions (imported by server/leave.py)
async def simulation_leave_error(
    payload: SimulationLeaveErrorPayload, room: str
) -> None:
    await sio.emit("simulations_leave_error", payload.model_dump(), room=room)


async def _simulation_leave_impl(sid: str, data: SimulationLeavePayload) -> None:
    """Leave a specific chat room"""
    chat_id = data.chat_id
    chat_type = _CHAT_TYPE_ALIASES.get(data.chat_type, data.chat_type)

    if not chat_id:
        await simulation_leave_error(
            SimulationLeaveErrorPayload(success=False, message="Missing chat_id"),
            room=sid,
        )
        return

    if chat_type not in _ALLOWED_CHAT_TYPES:
        await simulation_leave_error(
            SimulationLeaveErrorPayload(
                success=False, message=f"Invalid chat_type: {chat_type}"
            ),
            room=sid,
        )
        return

    room_name = f"{chat_type}_{chat_id}"
    await sio.leave_room(sid, room_name)
    await remove_active_connection(room_name, sid)
    # Log activity
    try:
        await log_websocket_activity(
            sid=sid,
            event_key="simulations.left",
            template="{{ actor.name }} left simulation chat",
            context={"chat_id": chat_id, "chat_type": chat_type},
            endpoint="/socket/v4/simulations/leave",
            error=False,
        )
    except Exception as log_error:
        pass


@sio.event  # type: ignore
async def simulation_leave(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = SimulationLeavePayload(**data)
        await _simulation_leave_impl(sid, validated)
    except ValidationError as e:
        await simulation_leave_error(
            SimulationLeaveErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.left",
                template="{{ actor.name }} failed to leave simulation chat (invalid payload)",
                context={"error": str(e)},
                endpoint="/socket/v4/simulations/leave",
                error=True,
            )
        except Exception as log_error:
            pass


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/leave", response_model=dict[str, bool])
async def simulation_leave_api(request: SimulationLeavePayload) -> dict[str, bool]:
    """Client-to-server event: Leave a simulation chat room."""
    return {"success": True}


@server_router.post("/leave_error", response_model=dict[str, bool])
async def simulation_leave_error_api(
    request: SimulationLeaveErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while leaving simulation chat room."""
    return {"success": True}
