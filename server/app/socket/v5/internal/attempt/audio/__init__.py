"""Internal attempt audio translators for v5.

Importing this module registers all generate_audio_* internal event handlers.
"""

from . import (
    delta,  # noqa: F401 — registers generate_audio_delta handler
    error,  # noqa: F401 — registers generate_audio_error handler
    speech_complete,  # noqa: F401 — registers generate_audio_user_speech_complete handler
    speech_delta,  # noqa: F401 — registers generate_audio_user_speech_delta handler
    speech_start,  # noqa: F401 — registers generate_audio_user_speech_start handler
    start,  # noqa: F401 — registers generate_audio_start handler
    stop,  # noqa: F401 — registers generate_audio_complete handler
)
