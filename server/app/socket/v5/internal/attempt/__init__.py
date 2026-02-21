"""Internal attempt event handlers for v5.

Importing this module registers:
- attempt_start (create/next-scenario logic)
- attempt_message (message handling + compose with generate)
- attempt_grade (grading preparation + compose with generate)
- attempt_chat (create/complete chats within attempts)
"""

from . import (
    chat,  # noqa: F401 — registers attempt_chat internal event
    grade,  # noqa: F401 — registers attempt_grade internal event
    message,  # noqa: F401 — registers attempt_message internal event
    start,  # noqa: F401 — registers attempt_start internal event
)
