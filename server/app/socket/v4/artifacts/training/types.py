"""WebSocket-specific types for training generation.

Extends base artifact types with training-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from uuid import UUID

from pydantic import BaseModel

from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
)

# Resource types that training generation can produce
TRAINING_GENERATE_RESOURCE_TYPES = [
    "departments",
    "personas",
    "documents",
    "parameter_fields",
    "scenarios",
    "parameters",
    "fields",
    "questions",
    "options",
    "videos",
    "images",
    "templates",
    "problem_statements",
    "objectives",
]


# =============================================================================
# Client-to-Server Events (training_generate)
# =============================================================================


class GenerateTrainingPayload(BaseModel):
    """Request payload for training_generate WebSocket event."""

    training_bundle_entry_id: UUID
    draft_id: UUID | None = None
    resource_types: list[str]
    user_instructions: list[str] | None = None
    save: bool = True


# =============================================================================
# Server-to-Client Events
# =============================================================================


class TrainingGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: training_generation_complete.

    Emitted when all agents have finished generating training resources.
    """

    artifact_type: str = "training"
    attempt_id: str | None = None
    chat_id: str | None = None


class TrainingGenerationProgressEvent(BaseModel):
    """Server-to-client event: training_generation_progress.

    Emitted as individual resources complete, providing percentage progress.
    """

    artifact_type: str = "training"
    group_id: str
    run_id: str | None = None
    completed_resources: int
    total_resources: int
    percentage: int  # 0-100
    last_completed_resource: str | None = None


class TrainingGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: training_generation_error.

    Emitted when training resource generation fails.
    """

    artifact_type: str = "training"
