"""Server attempt handlers — translate internal attempt_progress events to client events."""

from . import (  # noqa: F401 — registers handlers on import
    assistant_complete,
    assistant_hints,
    assistant_progress,
    assistant_start,
    audio_ended,
    audio_ready,
    chat_ended,
    chat_started,
    ended,
    error,
    grade_complete,
    grade_progress,
    grade_start,
    joined,
    response_result,
    started,
    stopped,
    user_complete,
    user_progress,
    user_start,
)
