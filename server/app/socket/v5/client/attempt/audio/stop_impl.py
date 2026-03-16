"""Re-export from canonical location in infra/websocket/attempt/.

All logic moved to app.infra.websocket.attempt.audio_stop.
This file re-exports for backwards compatibility.
"""

from app.infra.websocket.attempt.audio_stop import (  # noqa: F401
    AudioStopInternalResult,
    attempt_audio_stop_internal_impl,
)
