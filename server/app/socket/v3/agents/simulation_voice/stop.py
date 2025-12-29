"""Handler for simulation_voice_stop WebSocket event."""

from typing import Any

from app.infra.v3.activity.websocket_logger import log_websocket_activity
from app.main import _voice_message_ids, _voice_message_ids_lock, _voice_sessions, sio
from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models
class StopVoicePayload(BaseModel):
    """Request to stop a voice simulation session."""

    chat_id: str


class StopVoiceErrorPayload(BaseModel):
    """Response indicating an error occurred while stopping voice simulation."""

    success: bool
    message: str


class StopVoiceResponsePayload(BaseModel):
    """Response from stopping a voice simulation session."""

    success: bool
    message: str


# Emit helper functions
async def simulation_voice_stop_error(
    payload: StopVoiceErrorPayload, room: str
) -> None:
    await sio.emit("simulations_voice_stop_error", payload.model_dump(), room=room)


async def simulation_voice_stop_response(
    payload: StopVoiceResponsePayload, room: str
) -> None:
    await sio.emit("simulations_voice_stop_response", payload.model_dump(), room=room)


async def _simulation_voice_stop_impl(sid: str, data: StopVoicePayload) -> None:
    """Handle voice session stop requests via WebSocket."""
    try:
        logger.info(
            f"Received simulation_voice_stop request from {sid} for chat {data.chat_id}"
        )

        chat_id = data.chat_id
        if not chat_id:
            await simulation_voice_stop_error(
                StopVoiceErrorPayload(success=False, message="Missing chat_id"),
                room=sid,
            )
            return

        # Remove voice session
        if chat_id in _voice_sessions:
            del _voice_sessions[chat_id]
            logger.info(f"Stopped voice session for chat {chat_id}")
        else:
            logger.warning(f"No voice session found for chat {chat_id}")

        # Clear accumulated message IDs to prevent stale data
        async with _voice_message_ids_lock:
            if chat_id in _voice_message_ids:
                del _voice_message_ids[chat_id]
                logger.info(f"Cleared accumulated message IDs for chat {chat_id}")

        await simulation_voice_stop_response(
            StopVoiceResponsePayload(
                success=True, message="Voice session stopped successfully"
            ),
            room=sid,
        )
        # Log activity
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.voice.stopped",
                template="{{ actor.name }} stopped voice simulation",
                context={"chat_id": chat_id},
                endpoint="/socket/v3/simulations/voice/stop",
                error=False,
            )
        except Exception as log_error:
            logger.warning(f"Error logging voice simulation stop activity: {log_error}")

    except Exception as e:
        logger.error(
            f"Error in simulation_voice_stop for {sid}: {str(e)}", exc_info=True
        )
        await simulation_voice_stop_error(
            StopVoiceErrorPayload(success=False, message=str(e)), room=sid
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.voice.stopped",
                template="{{ actor.name }} failed to stop voice simulation",
                context={"error": str(e)},
                endpoint="/socket/v3/simulations/voice/stop",
                error=True,
            )
        except Exception as log_error:
            logger.warning(
                f"Error logging voice simulation stop error activity: {log_error}"
            )


@sio.event  # type: ignore
async def simulation_voice_stop(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""
    try:
        validated = StopVoicePayload(**data)
        await _simulation_voice_stop_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in simulation_voice_stop for {sid}: {e}")
        await simulation_voice_stop_error(
            StopVoiceErrorPayload(success=False, message=f"Invalid payload: {str(e)}"),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.voice.stopped",
                template="{{ actor.name }} failed to stop voice simulation (invalid payload)",
                context={"error": str(e)},
                endpoint="/socket/v3/simulations/voice/stop",
                error=True,
            )
        except Exception as log_error:
            logger.warning(
                f"Error logging voice simulation stop validation error activity: {log_error}"
            )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/stop", response_model=dict[str, bool])
async def simulation_voice_stop_api(request: StopVoicePayload) -> dict[str, bool]:
    """Client-to-server event: Stop a voice simulation session."""
    return {"success": True}


@server_router.post("/stop_response", response_model=dict[str, bool])
async def simulation_voice_stop_response_api(
    request: StopVoiceResponsePayload,
) -> dict[str, bool]:
    """Server-to-client event: Voice simulation stop response."""
    return {"success": True}


@server_router.post("/stop_error", response_model=dict[str, bool])
async def simulation_voice_stop_error_api(
    request: StopVoiceErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while stopping voice simulation."""
    return {"success": True}
