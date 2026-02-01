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

    Starts a new training session. Creates attempt + chat entries.
    """

    simulation_id: UUID
    agent_id: UUID  # Scenario generation agent
    scenario_id: UUID | None = None  # Optional - use first if not specified


# =============================================================================
# Server-to-Client Event Types
# =============================================================================


class TrainingStartedEvent(BaseModel):
    """Server-to-client event: training_started.

    Emitted when a new training session is created successfully.
    """

    artifact_type: str = "training"
    simulation_id: str
    attempt_id: str
    chat_id: str
    scenario_id: str | None = None
    scenario_data: dict | None = None  # {problem_statement, objectives, persona, video_ids, image_ids}


class TrainingProgressEvent(GenerationProgressEvent):
    """Server-to-client event: training_progress.

    Emitted during scenario generation to stream progress.
    """

    artifact_type: str = "training"
    scenario_id: str | None = None


class TrainingCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: training_complete.

    Emitted when scenario generation completes.
    """

    artifact_type: str = "training"
    scenario_id: str | None = None


class TrainingErrorEvent(GenerationErrorEvent):
    """Server-to-client event: training_error.

    Emitted when an error occurs during training generation.
    """

    artifact_type: str = "training"
    scenario_id: str | None = None
