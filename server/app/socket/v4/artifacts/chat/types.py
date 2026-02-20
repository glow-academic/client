"""WebSocket-specific types for chat generation.

Extends base artifact types with chat-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from uuid import UUID

from pydantic import BaseModel

from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
)

# =============================================================================
# Generation type constants
# =============================================================================

# Resource types that chat generation can produce
CHAT_GENERATE_RESOURCE_TYPES = [
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

CHAT_SYNC_ENTRY_TYPES = ["runs"]

CHAT_ASYNC_ENTRY_TYPES = ["debug_info"]


# =============================================================================
# Client-to-Server Events (chat_generate)
# =============================================================================


class GenerateChatPayload(BaseModel):
    """Request payload for chat_generate WebSocket event."""

    training_entry_id: UUID
    draft_id: UUID | None = None
    resource_types: list[str]
    user_instructions: list[str] | None = None
    save: bool = True


# =============================================================================
# Server-to-Client Events
# =============================================================================


class ChatGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: chat_generation_complete.

    Emitted when all agents have finished generating chat resources.
    """

    artifact_type: str = "chat"
    attempt_id: str | None = None
    chat_id: str | None = None


class ChatGenerationProgressEvent(BaseModel):
    """Server-to-client event: training_generation_progress.

    Emitted as individual resources complete, providing percentage progress.
    """

    artifact_type: str = "chat"
    group_id: str
    run_id: str | None = None
    completed_resources: int
    total_resources: int
    percentage: int  # 0-100
    last_completed_resource: str | None = None


class ChatGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: training_generation_error.

    Emitted when training resource generation fails.
    """

    artifact_type: str = "chat"
