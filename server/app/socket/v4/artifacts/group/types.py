"""WebSocket-specific types for group generation.

Extends base artifact types with group-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)


class GroupGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: group_generation_complete."""

    artifact_type: str = "group"


class GroupGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: group_generation_progress."""

    artifact_type: str = "group"


class GroupGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: group_generation_error."""

    artifact_type: str = "group"
