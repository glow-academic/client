"""WebSocket-specific types for eval generation."""

from uuid import UUID

from pydantic import BaseModel

from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)


class GenerateEvalPayload(BaseModel):
    """Request payload for eval_generate WebSocket event."""

    artifact_type: str = "eval"
    eval_id: UUID | None = None
    draft_id: UUID | None = None
    resource_types: list[str]
    user_instructions: list[str] | None = None


# =============================================================================
# Server-to-Client Events
# =============================================================================


class EvalGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: eval_generation_complete.

    Emitted when eval generation completes. Resource-level data is now
    sent via resource_generation_complete events from the shared handler.
    """

    artifact_type: str = "eval"


class EvalGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: eval_generation_progress."""

    artifact_type: str = "eval"


class EvalGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: eval_generation_error."""

    artifact_type: str = "eval"
