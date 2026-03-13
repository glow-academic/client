"""Internal attempt event handlers for v5.

Importing this module registers:
- attempt_start (create attempt, delegate to proceed)
- attempt_next (resolve context, delegate to proceed)
- attempt_proceed (shared core: completion marking, prepare → check → link/generate)
- user_start/progress/complete (user message received events)

Note: attempt-specific generation handlers (assistant_progress, assistant_complete,
assistant_hints, grade_progress, grade_complete) have been absorbed into the
canonical generate_[text/call]_[start/progress/complete] handlers in the parent module.
"""

from . import (
    audio,  # noqa: F401 — registers generate_audio_* internal events
    end,  # noqa: F401 — registers attempt_end internal event
    end_all,  # noqa: F401 — registers attempt_end_all internal event
    grade,  # noqa: F401 — registers attempt_grade internal event
    message,  # noqa: F401 — registers attempt_message internal event
    next,  # noqa: F401 — registers attempt_next internal event
    proceed,  # noqa: F401 — registers attempt_proceed internal event
    response,  # noqa: F401 — registers attempt_response_submit internal event
    start,  # noqa: F401 — registers attempt_start internal event
    stop,  # noqa: F401 — registers attempt_stop internal event
    use_previous,  # noqa: F401 — registers attempt_use_previous internal event
    user_complete,  # noqa: F401 — registers attempt_user_received_complete
    user_progress,  # noqa: F401 — registers attempt_user_received_progress
    user_start,  # noqa: F401 — registers attempt_user_received_start
)
