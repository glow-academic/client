"""Handler for simulation_voice_user_delta WebSocket event."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger

from app.main import sio

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models
class VoiceUserDeltaPayload(BaseModel):
    """Request to send incremental user speech delta in voice simulation."""

    chat_id: str
    item_id: str
    delta: str
    content_index: int


class VoiceUserDeltaErrorPayload(BaseModel):
    """Response indicating an error occurred in user speech delta."""

    success: bool
    message: str


# Emit helper functions
async def simulation_voice_user_delta_emit(
    payload: VoiceUserDeltaPayload, room: str
) -> None:
    """Emit simulation_voice_user_delta event to room (server-to-client)."""
    await sio.emit("simulations_voice_user_delta", payload.model_dump(), room=room)


async def simulation_voice_user_delta_error(
    payload: VoiceUserDeltaErrorPayload, room: str
) -> None:
    """Emit error event for simulation_voice_user_delta."""
    await sio.emit(
        "simulations_voice_user_delta_error", payload.model_dump(), room=room
    )


async def _simulation_voice_user_delta_impl(
    sid: str, data: VoiceUserDeltaPayload
) -> None:
    """Handle transcript delta event from Realtime API.

    This event is emitted when the user's speech transcription receives incremental
    updates. We relay it back to the room so AttemptMessages can update the optimistic
    message incrementally.
    """
    try:
        logger.info(
            f"Received simulation_voice_user_delta from {sid}: chat_id={data.chat_id}, "
            f"item_id={data.item_id}, delta_length={len(data.delta)}, content_index={data.content_index}"
        )

        chat_id = data.chat_id
        if not chat_id:
            logger.warning(f"Missing chat_id in simulation_voice_user_delta from {sid}")
            await simulation_voice_user_delta_error(
                VoiceUserDeltaErrorPayload(success=False, message="Missing chat_id"),
                room=sid,
            )
            return

        # Relay the event back to the room so AttemptMessages can listen for it
        normalized_chat_id = str(uuid.UUID(chat_id))
        room = f"simulation_{normalized_chat_id}"
        await simulation_voice_user_delta_emit(data, room)

        logger.info(
            f"Relayed simulation_voice_user_delta to room {room}: item_id={data.item_id}, delta_length={len(data.delta)}"
        )

    except Exception as e:
        logger.error(f"Error handling simulation_voice_user_delta: {e}", exc_info=True)
        await simulation_voice_user_delta_error(
            VoiceUserDeltaErrorPayload(success=False, message=str(e)),
            room=sid,
        )


@sio.event  # type: ignore
async def simulation_voice_user_delta(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""
    try:
        validated = VoiceUserDeltaPayload(**data)
        await _simulation_voice_user_delta_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in simulation_voice_user_delta for {sid}: {e}")
        await simulation_voice_user_delta_error(
            VoiceUserDeltaErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/delta", response_model=dict[str, bool])
async def simulation_voice_user_delta_api(
    request: VoiceUserDeltaPayload,
) -> dict[str, bool]:
    """Client-to-server event: Send incremental user speech delta in voice simulation."""
    return {"success": True}


@server_router.post("/delta", response_model=dict[str, bool])
async def simulation_voice_user_delta_server_api(
    request: VoiceUserDeltaPayload,
) -> dict[str, bool]:
    """Server-to-client event: User speech delta from voice simulation."""
    return {"success": True}


@server_router.post("/delta_error", response_model=dict[str, bool])
async def simulation_voice_user_delta_error_api(
    request: VoiceUserDeltaErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error while handling user speech delta."""
    return {"success": True}
