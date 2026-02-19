"""WebSocket-specific types for suite generation.

Extends base artifact types with suite-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)


class SuiteGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: suite_generation_complete."""

    artifact_type: str = "suite"


class SuiteGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: suite_generation_progress."""

    artifact_type: str = "suite"


class SuiteGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: suite_generation_error."""

    artifact_type: str = "suite"
