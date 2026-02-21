"""Internal (server-to-server) WebSocket event handlers for v5.

Importing this module registers all internal event handlers with the internal Socket.IO bus:
- generate (server-to-server generation dispatch)
- generate_artifact (token factory — LLM agentic loop)
- attempt_start (auto-proceed after chat completes)
- attempt_grade (grading triggered by attempt_end)
- attempt_chat (create/complete chats within attempts)
"""

from . import (
    attempt,  # noqa: F401 — registers attempt_* internal events
    generate,  # noqa: F401 — registers generate internal event
    generate_artifact,  # noqa: F401 — registers generate_artifact internal event
)
