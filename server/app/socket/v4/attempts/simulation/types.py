"""WebSocket-specific types for simulation attempt generation.

Extends base artifact types with attempt-specific fields.
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
# Client-to-Server Events (attempt_generate, attempt_regenerate)
# =============================================================================


class AttemptGeneratePayload(BaseModel):
    """Request payload for attempt_generate WebSocket event.

    Used when user sends a message during a simulation chat.
    """

    chat_id: UUID
    message: str
    group_id: UUID | None = None
    voice_mode: bool = False
    upload_id: UUID | None = None  # For voice audio uploads


class AttemptRegeneratePayload(BaseModel):
    """Request payload for attempt_regenerate WebSocket event.

    Used to regenerate the last assistant message.
    """

    chat_id: UUID
    message_id: UUID  # The assistant message to regenerate
    group_id: UUID | None = None
    voice_mode: bool = False


# =============================================================================
# Server-to-Client Events
# =============================================================================


class AttemptStartedEvent(BaseModel):
    """Server-to-client event: attempt_started.

    Emitted when a new assistant message placeholder is created.
    """

    artifact_type: str = "attempt"
    chat_id: str
    message_id: str
    run_id: str | None = None
    group_id: str | None = None


class AttemptProgressEvent(GenerationProgressEvent):
    """Server-to-client event: attempt_progress.

    Emitted during message generation to stream tokens.
    """

    artifact_type: str = "attempt"
    chat_id: str | None = None
    message_id: str | None = None
    delta: str | None = None
    accumulated_content: str | None = None


class AttemptCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: attempt_complete.

    Emitted when message generation completes and is saved to DB.
    """

    artifact_type: str = "attempt"
    chat_id: str | None = None
    message_id: str | None = None
    final_content: str | None = None
    completed: bool = True


class AttemptErrorEvent(GenerationErrorEvent):
    """Server-to-client event: attempt_error.

    Emitted when an error occurs during attempt generation.
    """

    artifact_type: str = "attempt"
    chat_id: str | None = None
    message_id: str | None = None
