"""Re-export from canonical location in infra/websocket/attempt/.

All logic moved to app.infra.websocket.attempt.audio_events.
This file re-exports for backwards compatibility.
"""

from app.infra.websocket.attempt.audio_events import (  # noqa: F401
    InternalBusAudioEmitter,
    get_audio_emitter,
)
