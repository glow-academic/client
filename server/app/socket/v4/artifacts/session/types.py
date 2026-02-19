"""WebSocket-specific types for session generation.

Extends base artifact types with session-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)


class SessionGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: session_generation_complete."""

    artifact_type: str = "session"


class SessionGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: session_generation_progress."""

    artifact_type: str = "session"


class SessionGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: session_generation_error."""

    artifact_type: str = "session"
