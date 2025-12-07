"""Handler for voice_assistant_turn_complete WebSocket event."""

import uuid
from typing import Any

from app.main import _voice_sessions, sio
from app.socket.simulations.send_message import (
    SimulationRunCompletePayload, simulation_run_complete)
from app.utils.logging.db_logger import get_logger
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)


# Pydantic models
class VoiceAssistantTurnCompletePayload(BaseModel):
    """Client-to-server payload for voice_assistant_turn_complete."""

    chat_id: str
    item_id: str


async def _voice_assistant_turn_complete_impl(
    sid: str, data: VoiceAssistantTurnCompletePayload
) -> None:
    """Handle assistant turn completion notification from Realtime API.

    When the assistant finishes speaking (audio_end event), emit simulation_run_complete
    to signal that the turn is done and hide the stop button.
    """
    try:
        logger.debug(
            f"Received voice_assistant_turn_complete from {sid} for chat {data.chat_id}, "
            f"item_id={data.item_id}"
        )

        chat_id = data.chat_id
        if not chat_id:
            logger.warning(
                f"Missing chat_id in voice_assistant_turn_complete from {sid}"
            )
            return

        # Verify session exists
        session_data = _voice_sessions.get(chat_id)
        if not session_data:
            logger.warning(
                f"voice_assistant_turn_complete received for non-existent session: {chat_id}"
            )
            return

        # Emit simulation_run_complete to signal that the assistant turn is done
        # This will hide the stop button in the client
        chat_id_uuid = uuid.UUID(chat_id)
        await simulation_run_complete(
            SimulationRunCompletePayload(chat_id=chat_id),
            room=f"simulation_{chat_id_uuid}",
        )

        logger.info(
            f"Emitted simulation_run_complete for chat {chat_id} (assistant turn complete)"
        )

    except Exception as e:
        logger.error(
            f"Error in voice_assistant_turn_complete for {sid}: {str(e)}", exc_info=True
        )


@sio.event  # type: ignore
async def voice_assistant_turn_complete(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""
    try:
        validated = VoiceAssistantTurnCompletePayload(**data)
        await _voice_assistant_turn_complete_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in voice_assistant_turn_complete for {sid}: {e}")

