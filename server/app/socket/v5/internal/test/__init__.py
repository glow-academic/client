"""Internal test event handlers for v5.

Importing this module registers:
- complete (generate_call_complete for grade results)
- progress (test_progress_update for generation deltas)
- error (test_error_event for errors)
"""

from . import (
    complete,  # noqa: F401 — registers generate_call_complete handler
    error,  # noqa: F401 — registers test_error_event handler
    group,  # noqa: F401 — registers test_group handler
    next,  # noqa: F401 — registers test_next handler
    proceed,  # noqa: F401 — registers test_proceed handler
    progress,  # noqa: F401 — registers test_progress_update handler
    run,  # noqa: F401 — registers test_run handler
    start,  # noqa: F401 — registers test_start handler
)
