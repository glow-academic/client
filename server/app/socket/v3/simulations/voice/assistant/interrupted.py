"""Handler for simulation_voice_assistant_interrupted WebSocket event."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import _voice_sessions, sio
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models
class VoiceInterruptedPayload(BaseModel):
    """Request to signal that assistant was interrupted in voice simulation."""

    chat_id: str


async def _simulation_voice_assistant_interrupted_impl(
    sid: str, data: VoiceInterruptedPayload
) -> None:
    """Handle audio interruption notification from Realtime API.

    This is just a notification - the client handles the interruption locally.
    We log it for debugging purposes.
    """
    try:
        logger.debug(
            f"Received simulation_voice_assistant_interrupted from {sid} for chat {data.chat_id}"
        )

        chat_id = data.chat_id
        if not chat_id:
            logger.warning(
                f"Missing chat_id in simulation_voice_assistant_interrupted from {sid}"
            )
            return

        # Verify session exists
        session_data = _voice_sessions.get(chat_id)
        if not session_data:
            logger.warning(
                f"simulation_voice_assistant_interrupted received for non-existent session: {chat_id}"
            )
            return

        logger.info(f"Audio interrupted for chat {chat_id}")

    except Exception as e:
        logger.error(
            f"Error in simulation_voice_assistant_interrupted for {sid}: {str(e)}",
            exc_info=True,
        )


@sio.event  # type: ignore
async def simulation_voice_assistant_interrupted(
    sid: str, data: dict[str, Any]
) -> None:
    """Wrapper that validates payload before calling actual handler."""
    try:
        validated = VoiceInterruptedPayload(**data)
        await _simulation_voice_assistant_interrupted_impl(sid, validated)
    except ValidationError as e:
        logger.error(
            f"Validation error in simulation_voice_assistant_interrupted for {sid}: {e}"
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/interrupted", response_model=dict[str, bool])
async def simulation_voice_assistant_interrupted_api(request: VoiceInterruptedPayload) -> dict[str, bool]:
    """Client-to-server event: Signal that assistant was interrupted in voice simulation."""
    return {"success": True}


@server_router.post("/interrupted", response_model=dict[str, bool])
async def simulation_voice_assistant_interrupted_server_api(request: VoiceInterruptedPayload) -> dict[str, bool]:
    """Server-to-client event: Signal that assistant was interrupted in voice simulation."""
    return {"success": True}
