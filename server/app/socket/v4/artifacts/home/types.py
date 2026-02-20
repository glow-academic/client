"""WebSocket-specific types for home generation.

Home generation creates an attempt synchronously, then delegates to
chat_generate on the internal bus for AI resource generation.
"""

from uuid import UUID

from pydantic import BaseModel

from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)

# Three-constant architecture for home
HOME_RESOURCE_TYPES: list[str] = []
HOME_ASYNC_ENTRY_TYPES = ["insights", "debug_info"]
HOME_SYNC_ENTRY_TYPES = ["runs", "attempts"]


# =============================================================================
# Client-to-Server Events (home_generate)
# =============================================================================


class GenerateHomePayload(BaseModel):
    """Request payload for home_generate WebSocket event."""

    training_entry_id: UUID
    infinite_mode: bool = False
    resource_types: list[str] | None = None
    save: bool = True
    draft_id: UUID | None = None
    user_instructions: list[str] | None = None


# =============================================================================
# Server-to-Client Events
# =============================================================================


class HomeGenerationStartedEvent(BaseModel):
    """Server-to-client event: home_generation_started."""

    artifact_type: str = "home"
    attempt_id: str
    training_entry_id: str


class HomeGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: home_generation_complete."""

    artifact_type: str = "home"


class HomeGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: home_generation_progress."""

    artifact_type: str = "home"


class HomeGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: home_generation_error."""

    artifact_type: str = "home"
