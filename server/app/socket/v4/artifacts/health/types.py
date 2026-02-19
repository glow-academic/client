"""WebSocket-specific types for health generation.

Extends base artifact types with health-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)


class HealthGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: health_generation_complete."""

    artifact_type: str = "health"


class HealthGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: health_generation_progress."""

    artifact_type: str = "health"


class HealthGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: health_generation_error."""

    artifact_type: str = "health"
