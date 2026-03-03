"""Internal (server-to-server) WebSocket event handlers for v5.

Importing this module registers all internal event handlers with the internal Socket.IO bus:

Generation pipeline:
- generate (rate limit gate — checks daily limit, then emits generate_prepare)
- generate_prepare (fetch resources, render instructions, dispatch generate_artifact)
- generate_artifact (token factory — LLM agentic loop)

Canonical event handlers (one per generate_* event):
- generate_text_start (placeholder)
- generate_text_progress (attempt assistant progress streaming)
- generate_text_complete (save assistant message to DB)
- generate_call_start (placeholder)
- generate_call_progress (placeholder)
- generate_call_complete (attempt hints, grade progress)
- generate_audio_start/progress/complete (handled in attempt/audio/)
- generate_image_start (media progress → generation_channel)
- generate_image_progress (placeholder)
- generate_image_complete (media complete → generation_channel)
- generate_video_start (media progress → generation_channel)
- generate_video_progress (media progress → generation_channel)
- generate_video_complete (media complete → generation_channel)
- generate_run_complete (tokens, auto-save, multi-agent, cleanup + audio continuation)

Generation side-effects:
- generation_progress (resource progress tracking)
- generation_error (error passthrough to generation_channel)
- generation_media (intercepts media tool_results → triggers image/video generation)

Attempt:
- attempt_start (auto-proceed after chat completes)
- attempt_proceed (shared core: completion marking, prepare → check → link/generate)
"""

from . import (
    attempt,  # noqa: F401 — registers attempt_* internal events
    generate,  # noqa: F401 — registers generate (rate limit gate)
    generate_artifact,  # noqa: F401 — registers generate_artifact internal event
    generate_call_complete,  # noqa: F401 — registers generate_call_complete handler
    generate_call_progress,  # noqa: F401 — registers generate_call_progress handler
    generate_call_start,  # noqa: F401 — registers generate_call_start handler
    generate_image_complete,  # noqa: F401 — registers generate_image_complete handler
    generate_image_progress,  # noqa: F401 — registers generate_image_progress handler
    generate_image_start,  # noqa: F401 — registers generate_image_start handler
    generate_prepare,  # noqa: F401 — registers generate_prepare internal event
    generate_run_complete,  # noqa: F401 — registers generate_run_complete handler
    generate_text_complete,  # noqa: F401 — registers generate_text_complete handler
    generate_text_progress,  # noqa: F401 — registers generate_text_progress handler
    generate_text_start,  # noqa: F401 — registers generate_text_start handler
    generate_video_complete,  # noqa: F401 — registers generate_video_complete handler
    generate_video_progress,  # noqa: F401 — registers generate_video_progress handler
    generate_video_start,  # noqa: F401 — registers generate_video_start handler
    generation_error,  # noqa: F401 — registers error handler
    generation_media,  # noqa: F401 — registers media generation handler
    generation_progress,  # noqa: F401 — registers progress handler
    test,  # noqa: F401 — registers test_* internal events
)
