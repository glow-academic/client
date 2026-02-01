"""Types for attempt simulation socket events.

Defines payload and event types for the attempt simulation WebSocket handlers:
- AttemptMessagePayload: Send a message during an attempt
- AttemptGradePayload: Grade an attempt

Entry types are predefined per handler (not in payload):
- message.py: ['messages', 'contents', 'hints'] - Message response tools
- grade.py: ['grades', 'feedbacks'] - Grading tools
"""

from typing import Any

from uuid import UUID

from pydantic import BaseModel

from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)


# =============================================================================
# Entry type constants (predefined per handler, not in payload)
# =============================================================================

ATTEMPT_MESSAGE_ENTRY_TYPES = ["messages", "contents", "hints"]
ATTEMPT_GRADE_ENTRY_TYPES = ["grades", "feedbacks"]


# =============================================================================
# Client-to-Server Event Payloads
# =============================================================================


class AttemptMessagePayload(BaseModel):
    """Request payload for attempt_message WebSocket event.

    Sends a user message during an active simulation chat.
    """

    simulation_id: UUID
    chat_agent_id: UUID  # Agent for conversation (explicit)
    chat_id: UUID
    message: str
    voice_mode: bool = False
    upload_id: UUID | None = None  # For voice audio uploads
    group_id: UUID | None = None  # For regeneration (uses existing group)


class AttemptGradePayload(BaseModel):
    """Request payload for attempt_grade WebSocket event.

    Ends the simulation and triggers grading.
    """

    simulation_id: UUID
    grade_agent_id: UUID  # Agent for grading (explicit)
    attempt_id: UUID
    chat_id: UUID | None = None  # Optional - grade specific chat or all


# =============================================================================
# Server-to-Client Event Types
# =============================================================================


class AttemptMessageSentEvent(BaseModel):
    """Server-to-client event: attempt_message_sent.

    Emitted when a user message is received and assistant placeholder created.
    """

    artifact_type: str = "attempt"
    chat_id: str
    user_message_id: str
    assistant_message_id: str
    run_id: str | None = None
    group_id: str | None = None


class AttemptGradedEvent(BaseModel):
    """Server-to-client event: attempt_graded.

    Emitted when simulation grading completes.
    """

    artifact_type: str = "attempt"
    simulation_id: str
    attempt_id: str
    chat_id: str | None = None
    grade_id: str | None = None
    score: int | None = None
    passed: bool | None = None
    feedback: str | None = None


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
