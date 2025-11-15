"""Emit hint generation progress via Socket.IO."""

import logging
import uuid
from typing import Any

logger = logging.getLogger(__name__)


async def emit_hint_progress(
    event_data: dict[str, Any],
    sio_instance: Any,
    chat_id: uuid.UUID,
) -> None:
    """Helper to emit hint generation progress via Socket.IO if available.

    Args:
        event_data: Dictionary containing event data to emit
        sio_instance: Socket.IO server instance
        chat_id: Chat UUID for room targeting
    """
    if sio_instance and chat_id:
        try:
            await sio_instance.emit(
                "hint_generation_progress",
                event_data,
                room=f"simulation_{chat_id}",
            )
        except Exception as e:
            logger.warning(f"Failed to emit hint progress: {e}")

