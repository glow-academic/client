"""WebSocket-specific types for reports generation.

Extends base artifact types with reports-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)


class ReportsGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: reports_generation_complete."""

    artifact_type: str = "reports"


class ReportsGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: reports_generation_progress."""

    artifact_type: str = "reports"


class ReportsGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: reports_generation_error."""

    artifact_type: str = "reports"
