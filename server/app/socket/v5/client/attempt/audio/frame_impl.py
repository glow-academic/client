"""Re-export from canonical location in infra/websocket/attempt/.

All logic moved to app.infra.websocket.attempt.audio_frame.
This file re-exports for backwards compatibility.
"""

from app.infra.websocket.attempt.audio_frame import (  # noqa: F401
    attempt_audio_frame_internal_impl,
)
