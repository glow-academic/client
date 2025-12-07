"""Handler for voice_speech_started WebSocket event."""

import datetime
from typing import Any

from app.main import get_voice_speech_timestamps, sio
from app.utils.logging.db_logger import get_logger
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)


# Pydantic models
class VoiceSpeechStartedPayload(BaseModel):
    """Client-to-server payload for voice_speech_started."""

    chat_id: str
    item_id: str


# Emit helper functions
async def voice_speech_started_emit(
    payload: VoiceSpeechStartedPayload, room: str
) -> None:
    """Emit voice_speech_started event to room (server-to-client)."""
    await sio.emit("voice_speech_started", payload.model_dump(), room=room)


async def _voice_speech_started_impl(
    sid: str, data: VoiceSpeechStartedPayload
) -> None:
    """Handle speech started event from Realtime API.

    This event is emitted when the user starts speaking. We relay it back
    to the room so AttemptMessages can create an optimistic user message.
    """
    try:
        logger.info(
            f"Received voice_speech_started from {sid}: chat_id={data.chat_id}, item_id={data.item_id}"
        )

        chat_id = data.chat_id
        if not chat_id:
            logger.warning(f"Missing chat_id in voice_speech_started from {sid}")
            return

        # Store timestamp for this speech event (for message ordering)
        timestamps_dict = get_voice_speech_timestamps()
        if chat_id not in timestamps_dict:
            timestamps_dict[chat_id] = {}
        timestamps_dict[chat_id][data.item_id] = datetime.datetime.now(
            datetime.timezone.utc
        )
        logger.info(
            f"Stored speech_started timestamp for chat_id={chat_id}, item_id={data.item_id}"
        )

        # Clean up stale timestamp entries (older than 5 minutes)
        # This prevents memory leaks if transcript_ready never arrives
        now = datetime.datetime.now(datetime.timezone.utc)
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
        await voice_speech_started_emit(data, room)

        logger.info(
            f"Relayed voice_speech_started to room {room}: item_id={data.item_id}"
        )

    except Exception as e:
        logger.error(f"Error handling voice_speech_started: {e}", exc_info=True)


@sio.event  # type: ignore
async def voice_speech_started(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""
    try:
        validated = VoiceSpeechStartedPayload(**data)
        await _voice_speech_started_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in voice_speech_started for {sid}: {e}")
