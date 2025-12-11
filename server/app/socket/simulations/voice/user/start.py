"""Handler for simulation_voice_user_start WebSocket event."""

import datetime
from typing import Any

from pydantic import BaseModel, ValidationError

from app.main import get_voice_speech_timestamps, sio
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


# Pydantic models
class VoiceUserStartPayload(BaseModel):
    """Client-to-server payload for simulation_voice_user_start."""

    chat_id: str
    item_id: str


# Emit helper functions
async def simulation_voice_user_start_emit(
    payload: VoiceUserStartPayload, room: str
) -> None:
    """Emit simulation_voice_user_start event to room (server-to-client)."""
    await sio.emit("simulation_voice_user_start", payload.model_dump(), room=room)


async def _simulation_voice_user_start_impl(
    sid: str, data: VoiceUserStartPayload
) -> None:
    """Handle speech started event from Realtime API.

    This event is emitted when the user starts speaking. We relay it back
    to the room so AttemptMessages can create an optimistic user message.
    """
    try:
        logger.info(
            f"Received simulation_voice_user_start from {sid}: chat_id={data.chat_id}, item_id={data.item_id}"
        )

        chat_id = data.chat_id
        if not chat_id:
            logger.warning(f"Missing chat_id in simulation_voice_user_start from {sid}")
            return

        # Store timestamp for this speech event (for message ordering)
        timestamps_dict = get_voice_speech_timestamps()
        if chat_id not in timestamps_dict:
            timestamps_dict[chat_id] = {}
        timestamps_dict[chat_id][data.item_id] = datetime.datetime.now(datetime.UTC)
        logger.info(
            f"Stored speech_started timestamp for chat_id={chat_id}, item_id={data.item_id}"
        )

        # Clean up stale timestamp entries (older than 5 minutes)
        # This prevents memory leaks if transcript_ready never arrives
        now = datetime.datetime.now(datetime.UTC)
        stale_threshold = datetime.timedelta(minutes=5)
        for chat_id_key in list(timestamps_dict.keys()):
            for item_id_key in list(timestamps_dict[chat_id_key].keys()):
                timestamp = timestamps_dict[chat_id_key][item_id_key]
                if now - timestamp > stale_threshold:
                    logger.warning(
                        f"Cleaning up stale timestamp for chat_id={chat_id_key}, item_id={item_id_key}"
                    )
                    del timestamps_dict[chat_id_key][item_id_key]
            # Clean up empty chat_id entries
            if not timestamps_dict[chat_id_key]:
                del timestamps_dict[chat_id_key]

        # Relay the event back to the room so AttemptMessages can listen for it
        room = f"simulation_{chat_id}"
        await simulation_voice_user_start_emit(data, room)

        logger.info(
            f"Relayed simulation_voice_user_start to room {room}: item_id={data.item_id}"
        )

    except Exception as e:
        logger.error(f"Error handling simulation_voice_user_start: {e}", exc_info=True)


@sio.event  # type: ignore
async def simulation_voice_user_start(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""
    try:
        validated = VoiceUserStartPayload(**data)
        await _simulation_voice_user_start_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in simulation_voice_user_start for {sid}: {e}")
