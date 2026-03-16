"""Re-export from canonical location in infra/websocket/attempt/.

All logic moved to app.infra.websocket.attempt.audio_start.
This file re-exports for backwards compatibility.
"""

from app.infra.websocket.attempt.audio_start import (  # noqa: F401
    AudioStartInternalResult,
    attempt_audio_start_internal_impl,
)
