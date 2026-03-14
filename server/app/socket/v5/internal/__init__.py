"""Internal (server-to-server) WebSocket event handlers for v5.

Importing this module registers all internal event handlers with the internal Socket.IO bus:

Generation pipeline:
- generation.generate (rate limit gate — checks daily limit, then emits generate_prepare)
- generation.generate_prepare (fetch resources, render instructions, dispatch generate_artifact)
- generation.generate_artifact (token factory — LLM agentic loop)

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
- generation.generation_progress (resource progress tracking)
- generation.generation_error (error passthrough to generation_channel)
Attempt:
- attempt_start (auto-proceed after chat completes)
- attempt_proceed (shared core: completion marking, prepare → check → link/generate)
"""

from . import attempt, generation, test  # noqa: F401
from .generate_call_complete import *  # noqa: F401,F403
from .generate_call_progress import *  # noqa: F401,F403
from .generate_call_start import *  # noqa: F401,F403
from .generate_image_complete import *  # noqa: F401,F403
from .generate_image_progress import *  # noqa: F401,F403
from .generate_image_start import *  # noqa: F401,F403
from .generate_run_complete import *  # noqa: F401,F403
from .generate_text_complete import *  # noqa: F401,F403
from .generate_text_progress import *  # noqa: F401,F403
from .generate_text_start import *  # noqa: F401,F403
from .generate_video_complete import *  # noqa: F401,F403
from .generate_video_progress import *  # noqa: F401,F403
from .generate_video_start import *  # noqa: F401,F403
