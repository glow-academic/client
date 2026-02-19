"""WebSocket-specific types for activity generation.

Extends base artifact types with activity-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from pydantic import BaseModel

from app.api.v4.artifacts.activity.types import GetActivityApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
)

# =============================================================================
# Generation type constants
# =============================================================================

ACTIVITY_RESOURCE_TYPES: list[str] = []

ACTIVITY_SYNC_ENTRY_TYPES = ["runs"]

ACTIVITY_ASYNC_ENTRY_TYPES = ["insights", "debug_info"]

# =============================================================================
# Client-to-Server Events (activity_generate)
# =============================================================================


class GenerateActivityPayload(GetActivityApiRequest):
    """Request payload for activity_generate WebSocket event."""

    resource_types: list[str]
    user_instructions: list[str] | None = None
    save: bool = True


# =============================================================================
# Server-to-Client Events
# =============================================================================


class ActivityGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: activity_generation_complete."""

    artifact_type: str = "activity"
    activity_id: str | None = None


class ActivityGenerationProgressEvent(BaseModel):
    """Server-to-client event: activity_generation_progress."""

    artifact_type: str = "activity"
    group_id: str
    run_id: str | None = None
    completed_resources: int
    total_resources: int
    percentage: int
    last_completed_resource: str | None = None


class ActivityGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: activity_generation_error."""

    artifact_type: str = "activity"
