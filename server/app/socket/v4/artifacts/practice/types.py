"""WebSocket-specific types for practice generation.

Practice generation follows the canonical pattern: creates an attempt,
then uses an independent config chain via get_practice_websocket() to
fetch resources and generate directly (no delegation to chat_generate).
"""

from uuid import UUID

from pydantic import BaseModel

from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)

# Three-constant architecture for practice
PRACTICE_RESOURCE_TYPES: list[str] = []
PRACTICE_ASYNC_ENTRY_TYPES = ["insights", "debug_info"]
PRACTICE_SYNC_ENTRY_TYPES = ["runs", "attempts"]


# =============================================================================
# Client-to-Server Events (practice_generate)
# =============================================================================


class GeneratePracticePayload(BaseModel):
    """Request payload for practice_generate WebSocket event."""

    training_entry_id: UUID
    infinite_mode: bool = False
    resource_types: list[str] | None = None
    save: bool = True
    draft_id: UUID | None = None
    user_instructions: list[str] | None = None


# =============================================================================
# Server-to-Client Events
# =============================================================================


class PracticeGenerationStartedEvent(BaseModel):
    """Server-to-client event: practice_generation_started."""

    artifact_type: str = "practice"
    attempt_id: str
    training_entry_id: str


class PracticeGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: practice_generation_complete."""

    artifact_type: str = "practice"


class PracticeGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: practice_generation_progress."""

    artifact_type: str = "practice"


class PracticeGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: practice_generation_error."""

    artifact_type: str = "practice"
