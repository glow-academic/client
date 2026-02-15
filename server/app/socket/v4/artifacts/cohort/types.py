"""WebSocket-specific types for cohort generation."""

from app.api.v4.artifacts.cohort.types import GetCohortApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)


class GenerateCohortPayload(GetCohortApiRequest):
    """Client payload for cohort_generate event."""

    resource_types: list[str]
    user_instructions: list[str] | None = None
    save: bool = True  # Whether to auto-save cohort on completion


class CohortGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: cohort_generation_complete.

    Emitted when cohort generation completes. Resource-level data is now
    sent via resource_generation_complete events from the shared handler.
    Contains optional cohort_id if auto-save succeeded.
    """

    artifact_type: str = "cohort"
    cohort_id: str | None = None


class CohortGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client cohort_generation_progress event."""

    artifact_type: str = "cohort"


class CohortGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client cohort_generation_error event."""

    artifact_type: str = "cohort"
