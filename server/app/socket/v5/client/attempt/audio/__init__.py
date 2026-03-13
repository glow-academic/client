"""Attempt audio client event handlers for v5.

Importing this module registers all attempt_audio_* events with Socket.IO.
"""

from . import (
    frame,  # noqa: F401 — registers @sio.event on import
    mute,  # noqa: F401
    start,  # noqa: F401
    stop,  # noqa: F401
    text_frame,  # noqa: F401
)
