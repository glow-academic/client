"""WebSocket-specific types for field generation (resource-type based)."""

from app.api.v4.artifacts.field.types import GetFieldApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)


class GenerateFieldPayload(GetFieldApiRequest):
    """Request payload for field_generate websocket event."""

    resource_types: list[str]
    user_instructions: list[str] | None = None


class FieldGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: field_generation_complete.

    Emitted when field generation completes. Resource-level data is now
    sent via resource_generation_complete events from the shared handler.
    """

    artifact_type: str = "field"


class FieldGenerationProgressEvent(GenerationProgressEvent):
    artifact_type: str = "field"


class FieldGenerationErrorEvent(GenerationErrorEvent):
    artifact_type: str = "field"
