"""Internal (server-to-server) WebSocket event handlers for v5.

Importing this module registers all internal event handlers with the internal Socket.IO bus:
- generate (server-to-server generation dispatch)
- generate_artifact (token factory — LLM agentic loop)
- generation_complete (run_complete — DB writes, multi-agent, auto-save)
- generation_progress (resource progress tracking)
- generation_error (error passthrough to generation_channel)
- generation_text (text_complete — save assistant messages)
- attempt_start (auto-proceed after chat completes)
- attempt_grade (grading triggered by attempt_end)
- attempt_chat (create/complete chats within attempts)
"""

from . import (
    attempt,  # noqa: F401 — registers attempt_* internal events
    generate,  # noqa: F401 — registers generate internal event
    generate_artifact,  # noqa: F401 — registers generate_artifact internal event
    generation_complete,  # noqa: F401 — registers run_complete handler
    generation_error,  # noqa: F401 — registers error handler
    generation_progress,  # noqa: F401 — registers progress handler
    generation_text,  # noqa: F401 — registers text_complete handler
    test,  # noqa: F401 — registers test_* internal events
)
