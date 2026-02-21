"""Internal attempt event handlers for v5.

Importing this module registers:
- attempt_start (auto-proceed after chat completes)
- attempt_grade (grading triggered by attempt_end)
- attempt_chat (create/complete chats within attempts)
"""

from . import (
    chat,  # noqa: F401 — registers attempt_chat internal event
    grade,  # noqa: F401 — registers attempt_grade internal event
    start,  # noqa: F401 — registers attempt_start internal event
)
