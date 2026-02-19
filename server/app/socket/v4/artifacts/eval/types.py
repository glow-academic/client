"""WebSocket-specific types for eval generation."""

from uuid import UUID

from pydantic import BaseModel

from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)

# =============================================================================
# Generation type constants
# =============================================================================

EVAL_RESOURCE_TYPES = [
    "names",
    "descriptions",
    "flags",
    "departments",
    "agents",
    "run_positions",
    "group_positions",
    "run_rubrics",
    "group_rubrics",
    # Temporary alias during hard migration rollout.
    "rubrics",
]

EVAL_SYNC_ENTRY_TYPES = ["runs"]

EVAL_ASYNC_ENTRY_TYPES = ["debug_info"]


class GenerateEvalPayload(BaseModel):
    """Request payload for eval_generate WebSocket event."""

    artifact_type: str = "eval"
    eval_id: UUID | None = None
    draft_id: UUID | None = None
    resource_types: list[str]
    user_instructions: list[str] | None = None
    save: bool = True


# =============================================================================
# Server-to-Client Events
# =============================================================================


class EvalGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: eval_generation_complete.

    Emitted when eval generation completes. Resource-level data is now
    sent via resource_generation_complete events from the shared handler.
    """

    artifact_type: str = "eval"
    eval_id: str | None = None


class EvalGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: eval_generation_progress."""

    artifact_type: str = "eval"


class EvalGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: eval_generation_error."""

    artifact_type: str = "eval"
