"""WebSocket-specific types for parameter generation.

Extends base artifact types with parameter-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from uuid import UUID

from pydantic import BaseModel

from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)

# =============================================================================
# Client-to-Server Events (parameter_generate)
# =============================================================================


class GenerateParameterPayload(BaseModel):
    """Request payload for parameter_generate WebSocket event."""

    artifact_type: str = "parameter"
    parameter_id: UUID | None = None
    draft_id: UUID | None = None
    resource_types: list[str]
    user_instructions: list[str] | None = None
    save: bool = True


# =============================================================================
# Server-to-Client Events
# =============================================================================


class ParameterGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: parameter_generation_complete.

    Emitted when parameter generation completes. Resource-level data is now
    sent via resource_generation_complete events from the shared handler.
    Contains optional parameter_id if auto-save succeeded.
    """

    artifact_type: str = "parameter"
    parameter_id: str | None = None


class ParameterGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: parameter_generation_progress.

    Emitted during parameter resource generation to show progress.
    """

    artifact_type: str = "parameter"


class ParameterGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: parameter_generation_error.

    Emitted when parameter resource generation fails.
    """

    artifact_type: str = "parameter"
