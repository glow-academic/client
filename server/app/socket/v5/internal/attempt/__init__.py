"""Internal attempt event handlers for v5.

Importing this module registers:
- attempt_start (create attempt, delegate to proceed)
- attempt_next (resolve context, delegate to proceed)
- attempt_proceed (shared core: completion marking, prepare → check → link/generate)
- attempt_message (message handling + compose with generate)
- attempt_grade (grading preparation + compose with generate)
- assistant_progress (text delta streaming for attempt artifacts)
- assistant_complete (run complete for assistant messages)
- assistant_hints (hints extraction from tool results)
- grade_progress (per-criterion grade results)
- grade_complete (aggregate grade result)
"""

from . import (
    assistant_complete,  # noqa: F401 — registers generate_*_complete internal events
    assistant_hints,  # noqa: F401 — registers generate_call_complete internal event
    assistant_progress,  # noqa: F401 — registers generate_text_progress internal event
    audio,  # noqa: F401 — registers generate_audio_* internal events
    grade,  # noqa: F401 — registers attempt_grade internal event
    grade_complete,  # noqa: F401 — registers generate_*_complete internal events
    grade_progress,  # noqa: F401 — registers generate_call_complete internal event
    message,  # noqa: F401 — registers attempt_message internal event
    next,  # noqa: F401 — registers attempt_next internal event
    proceed,  # noqa: F401 — registers attempt_proceed internal event
    start,  # noqa: F401 — registers attempt_start internal event
)
