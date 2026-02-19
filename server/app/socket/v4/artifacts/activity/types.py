"""WebSocket-specific types for activity generation.

Extends base artifact types with activity-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)


class ActivityGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: activity_generation_complete."""

    artifact_type: str = "activity"


class ActivityGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: activity_generation_progress."""

    artifact_type: str = "activity"


class ActivityGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: activity_generation_error."""

    artifact_type: str = "activity"
