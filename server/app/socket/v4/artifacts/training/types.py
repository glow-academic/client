"""Types for training simulation socket events.

Defines payload and event types for the training simulation WebSocket handlers:
- TrainingStartPayload: Start a new training session
- TrainingStartedEvent: Training session started successfully

Note: Training start creates structural entries (attempts, chats), not creatable entries.
Creatable entry type validation is not needed for this handler.
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

# Training start creates structural entries (attempts, chats), not creatable entries.
# Creatable entry validation is skipped when this is empty.
TRAINING_START_ENTRY_TYPES: list[str] = []


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

    training_bundle_entry_id: UUID  # Selected bundle from training/get
    department_id: UUID  # Department selected in UI
    draft_id: UUID  # Required training draft for bundle start
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
    scenario_data: dict | None = (
        None  # {problem_statement, objectives, persona, video_ids, image_ids}
    )


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
