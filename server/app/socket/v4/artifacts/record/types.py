"""WebSocket-specific types for record generation.

Extends base artifact types with record-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)


class RecordGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: record_generation_complete."""

    artifact_type: str = "record"


class RecordGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: record_generation_progress."""

    artifact_type: str = "record"


class RecordGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: record_generation_error."""

    artifact_type: str = "record"
