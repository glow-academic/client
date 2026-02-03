"""Types for training simulation socket events.

Defines payload and event types for the training simulation WebSocket handlers:
- TrainingStartPayload: Start a new training session
- TrainingStartedEvent: Training session started successfully

Entry types are predefined per handler (not in payload):
- start.py: ['chats'] - Creates attempt + chat only
"""

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

TRAINING_START_ENTRY_TYPES = ["chats"]


# =============================================================================
# Client-to-Server Event Payloads
# =============================================================================


class TrainingStartPayload(BaseModel):
    """Request payload for training_start WebSocket event.

    Starts a new training session. Server handles everything internally:
    - Checks if scenario needs generation
    - If generation needed, runs it and streams progress
    - Creates attempt + chat entries
    - Emits training_started when ready
    """

    simulation_id: UUID
    agent_id: UUID  # Content generation agent
    scenario_id: UUID | None = None  # Optional - uses first if not specified
    user_instructions: list[str] | None = None  # Optional generation hints
    infinite: bool | None = None  # Infinite mode - no time limit


# =============================================================================
# Server-to-Client Event Types
# =============================================================================


class TrainingStartedEvent(BaseModel):
    """Server-to-client event: training_started.

    ALWAYS sent when training session is ready. This is the only success event
    the client needs to handle. May be sent:
    - Immediately if no generation was needed
    - After generation completes if generation was needed
    """

    artifact_type: str = "training"
    simulation_id: str
    attempt_id: str
    chat_id: str
    scenario_id: str | None = None
    scenario_data: dict | None = None  # {problem_statement, objectives, persona, video_ids, image_ids}


class TrainingProgressEvent(GenerationProgressEvent):
    """Server-to-client event: training_progress.

    Optional - only sent if generation is happening. Client may not receive
    any progress events if scenario already has content.
    """

    artifact_type: str = "training"
    scenario_id: str | None = None


class TrainingCompleteEvent(GenerationCompleteEvent):
    """Internal event: generation complete.

    Used internally to trigger the completion flow. Not sent to client -
    client receives training_started instead.
    """

    artifact_type: str = "training"
    scenario_id: str | None = None


class TrainingErrorEvent(GenerationErrorEvent):
    """Server-to-client event: training_error.

    Emitted when an error occurs during training generation.
    """

    artifact_type: str = "training"
    scenario_id: str | None = None
